import { describe, it, expect, vi } from 'vitest';
import {
  extractDocument,
  DEFAULT_OCR_THRESHOLD,
} from '@/lib/extraction/document-extractor';
import {
  normalizeExtractedText,
  combinePageTexts,
} from '@/lib/extraction/text-normalizer';
import {
  CorruptDocumentError,
  EmptyExtractionError,
} from '@/types/errors';
import type { ExtractionProgress } from '@/types/document';
import {
  createValidPdf,
  createBlankPdf,
  createCorruptPdf,
  createMalformedHeaderPdf,
} from './helpers/pdf-fixtures';

describe('Document Extraction Pipeline', () => {
  describe('Text Normalizer', () => {
    it('cleans redundant whitespace, blank lines, and normalizes line endings', () => {
      const dirty = 'Hello \t world!\r\n\r\n\r\n\r\nThis is a    test.\n\n\n\nFinal.';
      const normalized = normalizeExtractedText(dirty);
      expect(normalized).toBe('Hello world!\n\nThis is a test.\n\nFinal.');
    });

    it('fixes hyphenated word breaks at line ends', () => {
      const hyphenated = 'This is an impor-\ntant docu-\nmentation piece.';
      const normalized = normalizeExtractedText(hyphenated);
      expect(normalized).toBe('This is an important documentation piece.');
    });

    it('combines page texts with standardized headers', () => {
      const pages = [
        { pageNumber: 1, text: 'Page one text' },
        { pageNumber: 2, text: 'Page two text' },
      ];
      const combined = combinePageTexts(pages);
      expect(combined).toContain('--- [Page 1] ---');
      expect(combined).toContain('Page one text');
      expect(combined).toContain('--- [Page 2] ---');
      expect(combined).toContain('Page two text');
    });
  });

  describe('PDF Text Extraction', () => {
    it('extracts native text and metadata from a valid PDF', async () => {
      const pdfBytes = createValidPdf('Technical Assessment Document Content');
      const doc = await extractDocument(pdfBytes, { ocrThreshold: 10 });

      expect(doc.text).toContain('Technical Assessment Document Content');
      expect(doc.pages).toHaveLength(1);
      expect(doc.pages[0].pageNumber).toBe(1);
      expect(doc.pages[0].method).toBe('native');
      expect(doc.method).toBe('native');
      expect(doc.totalCharCount).toBeGreaterThan(0);
      expect(doc.metadata.pageCount).toBe(1);
    });

    it('tracks extraction progress through callback stages', async () => {
      const pdfBytes = createValidPdf('Progress Tracking Test Document');
      const stages: string[] = [];

      await extractDocument(pdfBytes, {
        ocrThreshold: 10,
        onProgress: (progress: ExtractionProgress) => {
          stages.push(progress.stage);
        },
      });

      expect(stages).toContain('validating');
      expect(stages).toContain('loading');
      expect(stages).toContain('completed');
    });
  });

  describe('OCR Fallback Selection', () => {
    it('triggers OCR fallback when native text is below the character threshold', async () => {
      // Create a PDF with very sparse text (< 50 chars)
      const pdfBytes = createValidPdf('Short');
      
      const mockRecognizer = vi.fn().mockResolvedValue({
        text: 'This is the full OCR recovered text with high accuracy and details.',
        confidence: 95.5,
      });

      const doc = await extractDocument(pdfBytes, {
        ocrThreshold: 50, // "Short" is 5 chars < 50
        customOcrRecognizer: mockRecognizer,
      });

      expect(mockRecognizer).toHaveBeenCalled();
      expect(doc.pages[0].method).toBe('ocr');
      expect(doc.method).toBe('ocr');
      expect(doc.pages[0].confidence).toBe(95.5);
      expect(doc.text).toContain('This is the full OCR recovered text');
      expect(doc.metadata.isScanned).toBe(true);
    });

    it('forces OCR when forceOcr option is set to true', async () => {
      const pdfBytes = createValidPdf('This is long enough text for native extraction');
      
      const mockRecognizer = vi.fn().mockResolvedValue({
        text: 'OCR Forced Content Output',
        confidence: 92.0,
      });

      const doc = await extractDocument(pdfBytes, {
        forceOcr: true,
        customOcrRecognizer: mockRecognizer,
      });

      expect(mockRecognizer).toHaveBeenCalled();
      expect(doc.pages[0].method).toBe('ocr');
      expect(doc.method).toBe('ocr');
      expect(doc.text).toContain('OCR Forced Content Output');
    });

    it('does NOT trigger OCR when native text exceeds threshold and forceOcr is false', async () => {
      const longText = 'A'.repeat(DEFAULT_OCR_THRESHOLD + 20);
      const pdfBytes = createValidPdf(longText);

      const mockRecognizer = vi.fn();

      const doc = await extractDocument(pdfBytes, {
        ocrThreshold: 50,
        customOcrRecognizer: mockRecognizer,
      });

      expect(mockRecognizer).not.toHaveBeenCalled();
      expect(doc.pages[0].method).toBe('native');
      expect(doc.method).toBe('native');
    });
  });

  describe('Error Handling & Corrupt Documents', () => {
    it('throws CorruptDocumentError when PDF binary is missing header', async () => {
      const corruptData = createCorruptPdf();

      await expect(extractDocument(corruptData)).rejects.toThrow(
        CorruptDocumentError
      );
    });

    it('throws CorruptDocumentError when PDF header is malformed', async () => {
      const malformed = createMalformedHeaderPdf();

      await expect(extractDocument(malformed)).rejects.toThrow(
        CorruptDocumentError
      );
    });

    it('throws EmptyExtractionError when document contains no readable text and OCR produces nothing', async () => {
      const blankPdf = createBlankPdf();

      const emptyOcrRecognizer = vi.fn().mockResolvedValue({
        text: '',
        confidence: 0,
      });

      await expect(
        extractDocument(blankPdf, {
          ocrThreshold: 10,
          customOcrRecognizer: emptyOcrRecognizer,
        })
      ).rejects.toThrow(EmptyExtractionError);
    });
  });
});
