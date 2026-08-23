import { describe, it, expect } from 'vitest';
import {
  validateFileMetadata,
  validatePdfBuffer,
  hasPdfExtension,
  isPdfMimeType,
  hasPdfMagicBytes,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/validation/file-validation';
import { validateExtractedDocument } from '@/lib/validation/document-validation';
import {
  InvalidFileTypeError,
  FileTooLargeError,
  EmptyFileError,
  CorruptDocumentError,
  EmptyExtractionError,
} from '@/types/errors';
import { createValidPdf, createCorruptPdf } from './helpers/pdf-fixtures';

describe('Validation Pipeline', () => {
  describe('File Metadata Validation', () => {
    it('accepts valid PDF file metadata', () => {
      const result = validateFileMetadata({
        name: 'annual_report_2024.pdf',
        size: 1024 * 500, // 500 KB
        type: 'application/pdf',
      });

      expect(result.name).toBe('annual_report_2024.pdf');
      expect(result.size).toBe(512000);
      expect(result.type).toBe('application/pdf');
    });

    it('accepts valid PDF file with uppercase extension and missing MIME', () => {
      expect(hasPdfExtension('test.pdf')).toBe(true);
      expect(hasPdfExtension('TEST.PDF')).toBe(true);
      expect(hasPdfExtension('test.png')).toBe(false);
      expect(isPdfMimeType('application/pdf')).toBe(true);
      expect(isPdfMimeType('image/png')).toBe(false);

      const result = validateFileMetadata({
        name: 'INVOICE.PDF',
        size: 1024,
      });

      expect(result.name).toBe('INVOICE.PDF');
      expect(result.type).toBe('application/pdf');
    });

    it('rejects invalid file types (e.g. .docx, .png, .exe)', () => {
      expect(() =>
        validateFileMetadata({
          name: 'malware.exe',
          size: 1024,
          type: 'application/x-msdownload',
        })
      ).toThrow(InvalidFileTypeError);

      expect(() =>
        validateFileMetadata({
          name: 'photo.png',
          size: 2048,
          type: 'image/png',
        })
      ).toThrow(InvalidFileTypeError);
    });

    it('rejects empty file (0 bytes)', () => {
      expect(() =>
        validateFileMetadata({
          name: 'empty.pdf',
          size: 0,
          type: 'application/pdf',
        })
      ).toThrow(EmptyFileError);
    });

    it('rejects file exceeding size limit (> 20MB)', () => {
      expect(() =>
        validateFileMetadata({
          name: 'huge_document.pdf',
          size: MAX_FILE_SIZE_BYTES + 1024,
          type: 'application/pdf',
        })
      ).toThrow(FileTooLargeError);
    });
  });

  describe('PDF Binary & Magic Byte Validation', () => {
    it('validates a buffer with correct %PDF header', () => {
      const pdfBytes = createValidPdf();
      expect(hasPdfMagicBytes(pdfBytes)).toBe(true);

      const validated = validatePdfBuffer(pdfBytes, 'test.pdf');
      expect(validated).toBeInstanceOf(Uint8Array);
      expect(validated.byteLength).toBeGreaterThan(0);
    });

    it('rejects empty buffers', () => {
      const emptyBuffer = new Uint8Array(0);
      expect(() => validatePdfBuffer(emptyBuffer)).toThrow(EmptyFileError);
    });

    it('rejects corrupt buffers missing %PDF header', () => {
      const corruptBytes = createCorruptPdf();
      expect(hasPdfMagicBytes(corruptBytes)).toBe(false);
      expect(() => validatePdfBuffer(corruptBytes, 'corrupt.pdf')).toThrow(
        CorruptDocumentError
      );
    });
  });

  describe('Document Extraction Result Validation', () => {
    it('validates a well-formed extracted document', () => {
      const validDoc = {
        text: 'This is the full summary of the extracted document.',
        pages: [
          {
            pageNumber: 1,
            text: 'This is the full summary of the extracted document.',
            method: 'native' as const,
            charCount: 51,
          },
        ],
        method: 'native' as const,
        metadata: {
          pageCount: 1,
          fileName: 'report.pdf',
          fileSizeBytes: 1024,
        },
        totalCharCount: 51,
      };

      const result = validateExtractedDocument(validDoc);
      expect(result.text).toBe(validDoc.text);
      expect(result.pages).toHaveLength(1);
    });

    it('rejects empty extraction text', () => {
      const emptyDoc = {
        text: '',
        pages: [
          {
            pageNumber: 1,
            text: '',
            method: 'native' as const,
            charCount: 0,
          },
        ],
        method: 'native' as const,
        metadata: { pageCount: 1 },
        totalCharCount: 0,
      };

      expect(() => validateExtractedDocument(emptyDoc)).toThrow(
        EmptyExtractionError
      );
    });

    it('rejects whitespace-only extraction text', () => {
      const whitespaceDoc = {
        text: '   \n\n\t  \n  ',
        pages: [
          {
            pageNumber: 1,
            text: '   \n\n\t  \n  ',
            method: 'native' as const,
            charCount: 12,
          },
        ],
        method: 'native' as const,
        metadata: { pageCount: 1 },
        totalCharCount: 12,
      };

      expect(() => validateExtractedDocument(whitespaceDoc)).toThrow(
        EmptyExtractionError
      );
    });
  });
});
