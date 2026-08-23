import { describe, it, expect, vi } from 'vitest';
import { extractImageDocument } from '@/lib/extraction/image-extractor';
import {
  EmptyExtractionError,
  EmptyFileError,
  InvalidFileTypeError,
} from '@/types/errors';

describe('Image Extractor (Browser OCR)', () => {
  it('extracts text and builds valid ExtractedDocument from PNG image', async () => {
    const mockRecognizer = vi.fn().mockResolvedValue({
      text: 'ACME Corp Invoice\nTotal: $1,250.00\nDate: 2026-08-23',
      confidence: 94.5,
    });

    const fakePngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...new Array(50).fill(0)]);
    const file = new File([fakePngBytes], 'invoice.png', { type: 'image/png' });

    const result = await extractImageDocument(file, {
      customOcrRecognizer: mockRecognizer,
    });

    expect(mockRecognizer).toHaveBeenCalledTimes(1);
    expect(result.method).toBe('ocr');
    expect(result.text).toContain('ACME Corp Invoice');
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0].pageNumber).toBe(1);
    expect(result.pages[0].method).toBe('ocr');
    expect(result.pages[0].isScanned).toBe(true);
    expect(result.pages[0].confidence).toBe(94.5);
    expect(result.metadata.pageCount).toBe(1);
    expect(result.metadata.fileName).toBe('invoice.png');
    expect(result.metadata.fileSizeBytes).toBe(file.size);
    expect(result.metadata.isScanned).toBe(true);
  });

  it('supports JPG, JPEG, and WEBP image formats', async () => {
    const mockRecognizer = vi.fn().mockResolvedValue({
      text: 'Scanned receipt content from photo.',
      confidence: 88.0,
    });

    const fakeJpg = new File([new Uint8Array(100)], 'receipt.jpg', { type: 'image/jpeg' });
    const result = await extractImageDocument(fakeJpg, {
      customOcrRecognizer: mockRecognizer,
    });

    expect(result.method).toBe('ocr');
    expect(result.metadata.fileName).toBe('receipt.jpg');
    expect(result.text).toContain('Scanned receipt content');
  });

  it('throws EmptyFileError on 0-byte image file', async () => {
    const emptyFile = new File([], 'empty.png', { type: 'image/png' });
    await expect(
      extractImageDocument(emptyFile)
    ).rejects.toThrow(EmptyFileError);
  });

  it('throws InvalidFileTypeError on unsupported file types', async () => {
    const textFile = new File([new Uint8Array(100)], 'document.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
    await expect(
      extractImageDocument(textFile)
    ).rejects.toThrow(InvalidFileTypeError);
  });

  it('throws EmptyExtractionError when OCR returns empty or whitespace-only text', async () => {
    const mockRecognizer = vi.fn().mockResolvedValue({
      text: '   \n\t  ',
      confidence: 0,
    });

    const fakePng = new File([new Uint8Array(100)], 'blank.png', { type: 'image/png' });
    await expect(
      extractImageDocument(fakePng, { customOcrRecognizer: mockRecognizer })
    ).rejects.toThrow(EmptyExtractionError);
  });
});
