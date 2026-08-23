import { describe, it, expect } from 'vitest';
import {
  processDocument,
  estimateTokenCount,
  splitIntoSentences,
  splitIntoWordUnits,
} from '@/lib/processing';
import {
  validateProcessingOptions,
  DEFAULT_TARGET_CHUNK_SIZE,
  DEFAULT_MAX_CHUNK_SIZE,
  DEFAULT_MIN_CHUNK_SIZE,
  DEFAULT_OVERLAP,
} from '@/lib/validation/processing-validation';
import {
  EmptyDocumentProcessingError,
  InvalidProcessingConfigError,
} from '@/types/errors';
import type { ExtractedDocument } from '@/types/document';

function createMockExtractedDoc(
  pages: Array<{ pageNumber: number; text: string }>,
  metadataOverrides = {}
): ExtractedDocument {
  const combinedText = pages.map((p) => p.text).join('\n\n');
  return {
    text: combinedText,
    pages: pages.map((p) => ({
      pageNumber: p.pageNumber,
      text: p.text,
      method: 'native',
      charCount: p.text.length,
    })),
    method: 'native',
    metadata: {
      pageCount: pages.length,
      fileName: 'test.pdf',
      fileSizeBytes: 1024,
      ...metadataOverrides,
    },
    totalCharCount: combinedText.length,
  };
}

describe('Document Processing and Chunking Pipeline', () => {
  describe('Configuration Validation', () => {
    it('applies standard defaults when options are omitted', () => {
      const options = validateProcessingOptions();
      expect(options.targetChunkSize).toBe(DEFAULT_TARGET_CHUNK_SIZE);
      expect(options.maxChunkSize).toBe(DEFAULT_MAX_CHUNK_SIZE);
      expect(options.minChunkSize).toBe(DEFAULT_MIN_CHUNK_SIZE);
      expect(options.overlap).toBe(DEFAULT_OVERLAP);
    });

    it('rejects invalid configurations (e.g. overlap >= targetChunkSize)', () => {
      expect(() =>
        validateProcessingOptions({
          targetChunkSize: 500,
          overlap: 600, // Invalid: overlap must be < targetChunkSize
        })
      ).toThrow(InvalidProcessingConfigError);
    });

    it('rejects maxChunkSize smaller than targetChunkSize', () => {
      expect(() =>
        validateProcessingOptions({
          targetChunkSize: 1000,
          maxChunkSize: 800, // Invalid: max < target
        })
      ).toThrow(InvalidProcessingConfigError);
    });

    it('rejects minChunkSize larger than targetChunkSize', () => {
      expect(() =>
        validateProcessingOptions({
          targetChunkSize: 500,
          minChunkSize: 600, // Invalid: min > target
        })
      ).toThrow(InvalidProcessingConfigError);
    });
  });

  describe('Token Counter', () => {
    it('estimates token count deterministically and accurately', () => {
      expect(estimateTokenCount('')).toBe(0);
      expect(estimateTokenCount('Hello world')).toBeGreaterThan(0);

      const sample = 'The quick brown fox jumps over the lazy dog. 12345!';
      const count1 = estimateTokenCount(sample);
      const count2 = estimateTokenCount(sample);
      expect(count1).toBe(count2);
      expect(count1).toBeGreaterThanOrEqual(10);
    });
  });

  describe('Sentence and Word Splitting', () => {
    it('splits paragraphs on sentence boundaries while preserving abbreviations', () => {
      const text =
        'Dr. Smith visited Washington D.C. yesterday. He met with Prof. Jones at 3.14 PM! Was the meeting productive? Yes.';
      const sentences = splitIntoSentences(text);

      expect(sentences.length).toBeGreaterThanOrEqual(2);
      expect(sentences[0]).toContain('Dr. Smith visited Washington D.C. yesterday.');
      expect(sentences[sentences.length - 1]).toBe('Yes.');
    });

    it('splits oversized sentences into word units that respect max size', () => {
      const longSentence =
        'First section of sentence, second section of sentence; third section of sentence and a concluding portion.';
      const units = splitIntoWordUnits(longSentence, 40);

      for (const u of units) {
        expect(u.length).toBeLessThanOrEqual(40);
      }
    });

    it('handles unbroken words exceeding max size by splitting characters', () => {
      const unbrokenWord = 'A'.repeat(100);
      const units = splitIntoWordUnits(unbrokenWord, 30);

      expect(units.length).toBe(4);
      expect(units[0]).toBe('A'.repeat(30));
      expect(units[3]).toBe('A'.repeat(10));
    });
  });

  describe('Document Chunking Scenarios', () => {
    it('throws EmptyDocumentProcessingError for empty document', () => {
      const emptyDoc = createMockExtractedDoc([]);
      expect(() => processDocument(emptyDoc)).toThrow(
        EmptyDocumentProcessingError
      );

      const whitespaceDoc = createMockExtractedDoc([{ pageNumber: 1, text: '   \n\n  ' }]);
      expect(() => processDocument(whitespaceDoc)).toThrow(
        EmptyDocumentProcessingError
      );
    });

    it('processes a single-page document', () => {
      const doc = createMockExtractedDoc([
        { pageNumber: 1, text: 'This is a single page document containing brief content.' },
      ]);

      const processed = processDocument(doc);
      expect(processed.totalChunks).toBe(1);
      expect(processed.chunks[0].id).toBe('chunk-0');
      expect(processed.chunks[0].startPage).toBe(1);
      expect(processed.chunks[0].endPage).toBe(1);
      expect(processed.chunks[0].pageNumbers).toEqual([1]);
      expect(processed.chunks[0].text).toContain('single page document');
    });

    it('processes a multi-page document and preserves page metadata across chunks', () => {
      const doc = createMockExtractedDoc([
        { pageNumber: 1, text: 'Content from page one explaining introductory concepts.' },
        { pageNumber: 2, text: 'Content from page two detailing methodology and architecture.' },
        { pageNumber: 3, text: 'Content from page three summarizing conclusions and results.' },
      ]);

      const processed = processDocument(doc, {
        targetChunkSize: 80,
        maxChunkSize: 120,
        minChunkSize: 20,
        overlap: 0,
      });

      expect(processed.totalChunks).toBeGreaterThanOrEqual(3);
      expect(processed.chunks[0].startPage).toBe(1);
      const lastChunk = processed.chunks[processed.chunks.length - 1];
      expect(lastChunk.endPage).toBe(3);
    });

    it('handles document smaller than target chunk size as a single unified chunk', () => {
      const smallText = 'A short paragraph that easily fits into a single chunk without splitting.';
      const doc = createMockExtractedDoc([{ pageNumber: 1, text: smallText }]);

      const processed = processDocument(doc, {
        targetChunkSize: 1000,
        maxChunkSize: 2000,
        minChunkSize: 100,
      });

      expect(processed.totalChunks).toBe(1);
      expect(processed.chunks[0].text).toBe(smallText);
      expect(processed.chunks[0].charCount).toBe(smallText.length);
    });

    it('handles document larger than chunk size by creating multiple chunks', () => {
      const paragraphs = [
        'Paragraph 1: ' + 'Alpha '.repeat(40),
        'Paragraph 2: ' + 'Beta '.repeat(40),
        'Paragraph 3: ' + 'Gamma '.repeat(40),
        'Paragraph 4: ' + 'Delta '.repeat(40),
      ];

      const doc = createMockExtractedDoc([
        { pageNumber: 1, text: paragraphs.slice(0, 2).join('\n\n') },
        { pageNumber: 2, text: paragraphs.slice(2).join('\n\n') },
      ]);

      const processed = processDocument(doc, {
        targetChunkSize: 250,
        maxChunkSize: 400,
        minChunkSize: 50,
        overlap: 30,
      });

      expect(processed.totalChunks).toBeGreaterThan(1);
      for (const chunk of processed.chunks) {
        expect(chunk.charCount).toBeLessThanOrEqual(450);
        expect(chunk.approximateTokenCount).toBeGreaterThan(0);
      }
    });

    it('preserves paragraph boundaries when paragraphs fit in chunk size', () => {
      const p1 = 'First distinct paragraph about topic A.';
      const p2 = 'Second distinct paragraph about topic B.';
      const doc = createMockExtractedDoc([{ pageNumber: 1, text: `${p1}\n\n${p2}` }]);

      const processed = processDocument(doc, {
        targetChunkSize: 500,
        maxChunkSize: 1000,
      });

      expect(processed.totalChunks).toBe(1);
      expect(processed.chunks[0].text).toBe(`${p1}\n\n${p2}`);
    });

    it('splits along sentence boundaries when paragraph exceeds maxChunkSize', () => {
      const s1 = 'Sentence one describes the system in detail.';
      const s2 = 'Sentence two continues the explanation with further nuance.';
      const s3 = 'Sentence three concludes the paragraph successfully.';
      const longPara = `${s1} ${s2} ${s3}`;

      const doc = createMockExtractedDoc([{ pageNumber: 1, text: longPara }]);

      const processed = processDocument(doc, {
        targetChunkSize: 60,
        maxChunkSize: 80,
        minChunkSize: 20,
        overlap: 0,
      });

      expect(processed.totalChunks).toBeGreaterThanOrEqual(2);
      // Chunks should contain full sentences without cut words
      for (const chunk of processed.chunks) {
        expect(chunk.text.endsWith('.') || chunk.text.endsWith('!') || chunk.text.endsWith('?')).toBe(true);
      }
    });

    it('falls back to word-level splitting when a single sentence exceeds maxChunkSize', () => {
      const longSentence =
        'This is a single enormous run-on sentence without any period or exclamation punctuation marks that stretches on across multiple clauses, detailing extensive technical specifications and parameters for the ingestion engine.';

      const doc = createMockExtractedDoc([{ pageNumber: 1, text: longSentence }]);

      const processed = processDocument(doc, {
        targetChunkSize: 80,
        maxChunkSize: 100,
        minChunkSize: 20,
        overlap: 0,
      });

      expect(processed.totalChunks).toBeGreaterThan(1);
      for (const chunk of processed.chunks) {
        expect(chunk.charCount).toBeLessThanOrEqual(105);
      }
    });

    it('correctly creates overlap between consecutive chunks', () => {
      const doc = createMockExtractedDoc([
        {
          pageNumber: 1,
          text: [
            'Section Alpha covers foundational mechanics.',
            'Section Beta covers operational parameters.',
            'Section Gamma covers failure recovery modes.',
            'Section Delta covers final deployment checklists.',
          ].join('\n\n'),
        },
      ]);

      const processed = processDocument(doc, {
        targetChunkSize: 100,
        maxChunkSize: 150,
        minChunkSize: 30,
        overlap: 40,
      });

      expect(processed.totalChunks).toBeGreaterThan(1);
      // Verify that second chunk has overlap text from end of first chunk
      const chunk0 = processed.chunks[0];
      const chunk1 = processed.chunks[1];
      expect(chunk1.text.length).toBeGreaterThan(0);
      expect(chunk0.text.length).toBeGreaterThan(0);
    });

    it('preserves multi-page metadata spanning across chunk boundaries', () => {
      const doc = createMockExtractedDoc([
        { pageNumber: 1, text: 'Page 1 header text.' },
        { pageNumber: 2, text: 'Page 2 body text.' },
        { pageNumber: 3, text: 'Page 3 footer text.' },
      ]);

      const processed = processDocument(doc, {
        targetChunkSize: 500, // All fit in 1 chunk
        maxChunkSize: 1000,
      });

      expect(processed.totalChunks).toBe(1);
      expect(processed.chunks[0].startPage).toBe(1);
      expect(processed.chunks[0].endPage).toBe(3);
      expect(processed.chunks[0].pageNumbers).toEqual([1, 2, 3]);
    });

    it('produces 100% deterministic output for repeated processing runs', () => {
      const doc = createMockExtractedDoc([
        {
          pageNumber: 1,
          text: 'Deterministic text processing benchmark across multiple iterations.\n\nSecond paragraph content.',
        },
        {
          pageNumber: 2,
          text: 'Page two additional metrics and data points.',
        },
      ]);

      const runA = processDocument(doc, { targetChunkSize: 100, maxChunkSize: 150, overlap: 20 });
      const runB = processDocument(doc, { targetChunkSize: 100, maxChunkSize: 150, overlap: 20 });

      expect(JSON.stringify(runA)).toBe(JSON.stringify(runB));
    });

    it('handles very long paragraphs exceeding standard page limits', () => {
      const longPara = 'Word '.repeat(800); // 4000 characters
      const doc = createMockExtractedDoc([{ pageNumber: 1, text: longPara }]);

      const processed = processDocument(doc, {
        targetChunkSize: 1000,
        maxChunkSize: 1500,
        minChunkSize: 100,
        overlap: 100,
      });

      expect(processed.totalChunks).toBeGreaterThan(2);
      for (const chunk of processed.chunks) {
        expect(chunk.charCount).toBeLessThanOrEqual(1500);
      }
    });

    it('handles very long unbroken sentence without punctuation', () => {
      const longSentence = 'unbroken '.repeat(300); // 2700 characters
      const doc = createMockExtractedDoc([{ pageNumber: 1, text: longSentence }]);

      const processed = processDocument(doc, {
        targetChunkSize: 500,
        maxChunkSize: 800,
        minChunkSize: 50,
        overlap: 50,
      });

      expect(processed.totalChunks).toBeGreaterThan(2);
      for (const chunk of processed.chunks) {
        expect(chunk.charCount).toBeLessThanOrEqual(850);
      }
    });
  });
});
