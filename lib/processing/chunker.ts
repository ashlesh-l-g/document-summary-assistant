import type { ExtractedPage } from '@/types/document';
import type { DocumentChunk, ProcessingOptions } from '@/types/processing';
import { estimateTokenCount } from './token-counter';

export interface TextUnit {
  readonly text: string;
  readonly pageNumber: number;
  readonly isParagraphBoundary: boolean;
}

/**
 * Common abbreviations that should not trigger sentence boundaries
 */
const ABBREVIATIONS = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'sr',
  'jr',
  'vs',
  'etc',
  'fig',
  'e.g',
  'i.e',
  'al',
  'no',
  'vol',
  'dept',
  'approx',
]);

/**
 * Split text into sentences using punctuation boundaries while respecting abbreviations and numbers
 */
export function splitIntoSentences(text: string): string[] {
  if (!text || text.trim().length === 0) {
    return [];
  }

  const rawSentences: string[] = [];
  let currentSentence = '';
  const words = text.split(/(\s+)/);

  for (let i = 0; i < words.length; i++) {
    const part = words[i];
    currentSentence += part;

    // Check if the part ends with sentence-ending punctuation (. ? !)
    const match = part.match(/([.!?]+)(["')\]}]*)$/);
    if (match) {
      const cleanWord = part.replace(/[^\w]/g, '').toLowerCase();
      // If it's an abbreviation, don't split
      if (ABBREVIATIONS.has(cleanWord)) {
        continue;
      }
      // If next word starts with lowercase, likely not a sentence break
      const nextWord = words[i + 2];
      if (nextWord && /^[a-z]/.test(nextWord.trim())) {
        continue;
      }

      if (currentSentence.trim().length > 0) {
        rawSentences.push(currentSentence.trim());
        currentSentence = '';
      }
    }
  }

  if (currentSentence.trim().length > 0) {
    rawSentences.push(currentSentence.trim());
  }

  return rawSentences.length > 0 ? rawSentences : [text.trim()];
}

/**
 * Split an oversized sentence into words or clause chunks that fit within maxSize
 */
export function splitIntoWordUnits(text: string, maxSize: number): string[] {
  if (text.length <= maxSize) {
    return [text];
  }

  // Try splitting by clause punctuation first (, ; :)
  const clauses = text.split(/(?<=[,;:])\s+/);
  if (clauses.length > 1) {
    const results: string[] = [];
    let currentClause = '';

    for (const clause of clauses) {
      if (clause.length > maxSize) {
        // Fall back to whitespace split for this clause
        if (currentClause.length > 0) {
          results.push(currentClause.trim());
          currentClause = '';
        }
        results.push(...splitIntoWordUnits(clause, maxSize));
      } else if (currentClause.length + clause.length + 1 <= maxSize) {
        currentClause = currentClause.length === 0 ? clause : `${currentClause} ${clause}`;
      } else {
        if (currentClause.length > 0) {
          results.push(currentClause.trim());
        }
        currentClause = clause;
      }
    }
    if (currentClause.trim().length > 0) {
      results.push(currentClause.trim());
    }
    return results;
  }

  // Split by whitespace
  const words = text.split(/\s+/);
  const units: string[] = [];
  let current = '';

  for (const word of words) {
    if (word.length > maxSize) {
      // Hard split of oversized unbroken word
      if (current.length > 0) {
        units.push(current.trim());
        current = '';
      }
      for (let i = 0; i < word.length; i += maxSize) {
        units.push(word.slice(i, i + maxSize));
      }
    } else if (current.length + word.length + 1 <= maxSize) {
      current = current.length === 0 ? word : `${current} ${word}`;
    } else {
      if (current.length > 0) {
        units.push(current.trim());
      }
      current = word;
    }
  }

  if (current.trim().length > 0) {
    units.push(current.trim());
  }

  return units;
}

/**
 * Break page text into hierarchical atomic units (Paragraph -> Sentence -> Words)
 */
export function decomposePageIntoUnits(
  page: ExtractedPage,
  maxSize: number
): TextUnit[] {
  const units: TextUnit[] = [];
  const rawParagraphs = page.text.split(/\n\n+/);

  for (let pIdx = 0; pIdx < rawParagraphs.length; pIdx++) {
    const para = rawParagraphs[pIdx].trim();
    if (para.length === 0) continue;

    if (para.length <= maxSize) {
      units.push({
        text: para,
        pageNumber: page.pageNumber,
        isParagraphBoundary: true,
      });
    } else {
      // Decompose paragraph into sentences
      const sentences = splitIntoSentences(para);
      let isFirstSentence = true;

      for (const sentence of sentences) {
        if (sentence.length <= maxSize) {
          units.push({
            text: sentence,
            pageNumber: page.pageNumber,
            isParagraphBoundary: isFirstSentence,
          });
        } else {
          // Decompose oversized sentence into word units
          const wordUnits = splitIntoWordUnits(sentence, maxSize);
          let isFirstWordUnit = isFirstSentence;

          for (const wordUnit of wordUnits) {
            units.push({
              text: wordUnit,
              pageNumber: page.pageNumber,
              isParagraphBoundary: isFirstWordUnit,
            });
            isFirstWordUnit = false;
          }
        }
        isFirstSentence = false;
      }
    }
  }

  return units;
}

/**
 * Assemble text units into deterministic chunks with configurable target, max, min, and overlap
 */
export function createChunksFromUnits(
  units: readonly TextUnit[],
  options: Required<ProcessingOptions>
): DocumentChunk[] {
  if (!units || units.length === 0) {
    return [];
  }

  const { targetChunkSize, maxChunkSize, minChunkSize, overlap } = options;
  const chunks: DocumentChunk[] = [];
  let currentUnits: TextUnit[] = [];
  let chunkIndex = 0;

  function buildChunkText(unitList: readonly TextUnit[]): string {
    let result = '';
    for (let i = 0; i < unitList.length; i++) {
      const u = unitList[i];
      if (i === 0) {
        result += u.text;
      } else if (u.isParagraphBoundary) {
        result += `\n\n${u.text}`;
      } else {
        result += ` ${u.text}`;
      }
    }
    return result.trim();
  }

  function emitChunk(unitList: readonly TextUnit[]): DocumentChunk {
    const text = buildChunkText(unitList);
    const pageNumbers = Array.from(new Set(unitList.map((u) => u.pageNumber))).sort(
      (a, b) => a - b
    );
    const startPage = pageNumbers.length > 0 ? pageNumbers[0] : 1;
    const endPage = pageNumbers.length > 0 ? pageNumbers[pageNumbers.length - 1] : startPage;

    const chunk: DocumentChunk = {
      id: `chunk-${chunkIndex}`,
      index: chunkIndex,
      text,
      startPage,
      endPage,
      pageNumbers,
      charCount: text.length,
      approximateTokenCount: estimateTokenCount(text),
    };
    chunkIndex++;
    return chunk;
  }

  function getOverlapUnits(unitList: readonly TextUnit[], targetOverlap: number): TextUnit[] {
    if (targetOverlap <= 0 || unitList.length <= 1) {
      return [];
    }

    const overlapList: TextUnit[] = [];
    let accumulatedLength = 0;

    for (let i = unitList.length - 1; i >= 0; i--) {
      const u = unitList[i];
      overlapList.unshift(u);
      accumulatedLength += u.text.length + 1;
      if (accumulatedLength >= targetOverlap) {
        break;
      }
    }

    // Do not retain the entire chunk as overlap (must leave progress)
    if (overlapList.length >= unitList.length) {
      return unitList.slice(1);
    }

    return overlapList;
  }

  for (let i = 0; i < units.length; i++) {
    const unit = units[i];

    if (currentUnits.length === 0) {
      currentUnits.push(unit);
      continue;
    }

    const prospectiveText = buildChunkText([...currentUnits, unit]);

    // If adding this unit exceeds target size and current accumulator meets minimum size, or would exceed maxChunkSize
    if (
      (prospectiveText.length > targetChunkSize && prospectiveText.length >= minChunkSize) ||
      prospectiveText.length > maxChunkSize
    ) {
      // Emit current chunk
      chunks.push(emitChunk(currentUnits));

      // Calculate overlap
      const overlapUnits = getOverlapUnits(currentUnits, overlap);
      currentUnits = [...overlapUnits, unit];
    } else {
      currentUnits.push(unit);
    }
  }

  // Handle final remaining units
  if (currentUnits.length > 0) {
    const remainingText = buildChunkText(currentUnits);

    // If final units are smaller than minChunkSize and we already have chunks, try merging into previous chunk if it fits in maxChunkSize
    if (
      chunks.length > 0 &&
      remainingText.length < minChunkSize &&
      chunks[chunks.length - 1].charCount + remainingText.length + 2 <= maxChunkSize
    ) {
      const prevChunk = chunks[chunks.length - 1];
      const mergedText = `${prevChunk.text}\n\n${remainingText}`;
      const lastUnitPage = currentUnits[currentUnits.length - 1].pageNumber;
      const updatedPages = Array.from(
        new Set([...prevChunk.pageNumbers, ...currentUnits.map((u) => u.pageNumber)])
      ).sort((a, b) => a - b);

      chunks[chunks.length - 1] = {
        ...prevChunk,
        text: mergedText,
        endPage: Math.max(prevChunk.endPage, lastUnitPage),
        pageNumbers: updatedPages,
        charCount: mergedText.length,
        approximateTokenCount: estimateTokenCount(mergedText),
      };
    } else {
      chunks.push(emitChunk(currentUnits));
    }
  }

  return chunks;
}
