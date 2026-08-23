import type {
  ExtractedDocument,
  ExtractedPage,
  ExtractionOptions,
} from '@/types/document';
import {
  EmptyExtractionError,
  EmptyFileError,
} from '@/types/errors';
import {
  validateImageMetadata,
} from '@/lib/validation/file-validation';
import { validateExtractedDocument } from '@/lib/validation/document-validation';
import { defaultTesseractRecognizer } from './ocr-extractor';
import { normalizeExtractedText } from './text-normalizer';

/**
 * Ingest and extract text from an image document (PNG, JPG, JPEG, WEBP) using Tesseract OCR.
 * Runs in browser or in environments with a supported recognizer.
 */
export async function extractImageDocument(
  input: File | Blob | ArrayBuffer | Uint8Array | string,
  options?: ExtractionOptions
): Promise<ExtractedDocument> {
  options?.onProgress?.({
    stage: 'validating',
    percent: 10,
    message: 'Validating image...',
  });

  let fileName: string | undefined;
  let fileSize = 0;
  let mimeType: string | undefined;
  let ocrInput: Parameters<typeof defaultTesseractRecognizer>[0];

  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    fileName = 'name' in input ? (input as File).name : 'image.png';
    fileSize = input.size;
    mimeType = input.type || 'image/png';
    ocrInput = input;
  } else if (input instanceof ArrayBuffer) {
    fileSize = input.byteLength;
    mimeType = 'image/png';
    ocrInput = new Uint8Array(input);
  } else if (input instanceof Uint8Array) {
    fileSize = input.byteLength;
    mimeType = 'image/png';
    ocrInput = input;
  } else if (typeof input === 'string') {
    fileSize = input.length;
    fileName = 'image.png';
    mimeType = 'image/png';
    ocrInput = input;
  } else {
    throw new EmptyFileError('Unsupported input type provided to image extractor.');
  }

  // Validate image metadata
  validateImageMetadata({
    name: fileName || 'image.png',
    size: fileSize,
    type: mimeType,
  });

  options?.onProgress?.({
    stage: 'ocr',
    currentPage: 1,
    totalPages: 1,
    percent: 30,
    message: 'Running OCR on image...',
  });

  const recognizer = options?.customOcrRecognizer || defaultTesseractRecognizer;
  const result = await recognizer(ocrInput, {
    language: options?.ocrLanguage || 'eng',
    pageNumber: 1,
  });

  const normalizedText = normalizeExtractedText(result.text || '');

  if (normalizedText.length === 0) {
    throw new EmptyExtractionError(
      'OCR was unable to extract any readable text from the uploaded image.',
      { fileName }
    );
  }

  const page: ExtractedPage = {
    pageNumber: 1,
    text: normalizedText,
    method: 'ocr',
    charCount: normalizedText.length,
    confidence: result.confidence,
    isScanned: true,
  };

  const extractedDoc: ExtractedDocument = {
    text: normalizedText,
    pages: [page],
    method: 'ocr',
    metadata: {
      pageCount: 1,
      fileName,
      fileSizeBytes: fileSize,
      mimeType,
      isScanned: true,
    },
    totalCharCount: normalizedText.length,
  };

  const validatedDoc = validateExtractedDocument(extractedDoc);

  options?.onProgress?.({
    stage: 'completed',
    percent: 100,
    message: 'Image OCR extraction completed successfully.',
  });

  return validatedDoc;
}
