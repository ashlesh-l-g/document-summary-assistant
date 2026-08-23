/**
 * Utility functions to clean, normalize, and format extracted document text
 */

/**
 * Normalizes a raw string by:
 * - Unifying CRLF and CR to LF
 * - Fixing hyphenated line breaks (e.g., "infor-\nmation" -> "information")
 * - Removing unprintable ASCII / unicode control codes (preserving tabs and newlines)
 * - Collapsing multiple consecutive spaces
 * - Collapsing excessive blank lines (max 2 consecutive newlines)
 * - Trimming leading/trailing whitespace
 */
export function normalizeExtractedText(rawText: string): string {
  if (!rawText) return '';

  return (
    rawText
      // Unify newlines
      .replace(/\r\n|\r/g, '\n')
      // Remove null characters and non-printable control characters (except \n, \t)
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
      // Fix hyphenated line breaks (word continuation across lines)
      .replace(/(\w+)-\n(\w+)/g, '$1$2')
      // Collapse multiple horizontal spaces/tabs on the same line to a single space
      .replace(/[^\S\n]+/g, ' ')
      // Remove spaces at the beginning and end of each line
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      // Collapse 3 or more consecutive newlines into 2
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  );
}

/**
 * Combines page texts with standardized page boundary markers
 */
export function combinePageTexts(
  pages: ReadonlyArray<{ pageNumber: number; text: string }>
): string {
  if (!pages || pages.length === 0) return '';

  return pages
    .filter((p) => p.text.trim().length > 0)
    .map((p) => `--- [Page ${p.pageNumber}] ---\n${p.text.trim()}`)
    .join('\n\n');
}
