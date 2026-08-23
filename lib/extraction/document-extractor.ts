import type {
  ExtractedDocument,
  ExtractedPage,
  ExtractionMethod,
  ExtractionOptions,
} from '@/types/document';
import {
  EmptyFileError,
  EmptyExtractionError,
} from '@/types/errors';
import {
  validateFileMetadata,
  validatePdfBuffer,
} from '@/lib/validation/file-validation';
import { validateExtractedDocument } from '@/lib/validation/document-validation';
import { extractNativePdf } from './pdf-extractor';
import { performPageOcr } from './ocr-extractor';
import { combinePageTexts } from './text-normalizer';

/**
 * Default threshold in characters. If a page has fewer than this number of
 * characters extracted natively, OCR fallback is triggered.
 */
export const DEFAULT_OCR_THRESHOLD = 50;

/**
 * Convert various input types (File, Blob, ArrayBuffer, Uint8Array) into a Uint8Array
 */
export async function resolveInputBuffer(
  input: File | Blob | ArrayBuffer | Uint8Array
): Promise<{ buffer: Uint8Array; fileName?: string; fileSize: number; mimeType?: string }> {
  if (typeof Blob !== 'undefined' && input instanceof Blob) {
    const arrayBuffer = await input.arrayBuffer();
    const fileName = 'name' in input ? (input as File).name : undefined;
    return {
      buffer: new Uint8Array(arrayBuffer),
      fileName,
      fileSize: input.size,
      mimeType: input.type,
    };
  }

  if (input instanceof ArrayBuffer) {
    return {
      buffer: new Uint8Array(input),
      fileSize: input.byteLength,
      mimeType: 'application/pdf',
    };
  }

  if (input instanceof Uint8Array) {
    return {
      buffer: input,
      fileSize: input.byteLength,
      mimeType: 'application/pdf',
    };
  }

  throw new EmptyFileError('Unsupported input type provided to document extractor.');
}

/**
 * Ingest and extract text from a PDF document using native extraction with intelligent OCR fallback
 */
export async function extractDocument(
  input: File | Blob | ArrayBuffer | Uint8Array,
  options?: ExtractionOptions
): Promise<ExtractedDocument> {
  const ocrThreshold = options?.ocrThreshold ?? DEFAULT_OCR_THRESHOLD;

  options?.onProgress?.({
    stage: 'validating',
    percent: 5,
    message: 'Validating PDF document...',
  });

  // 1. Resolve binary buffer and file metadata
  const { buffer, fileName, fileSize, mimeType } = await resolveInputBuffer(input);

  // 2. Validate file metadata if available
  if (fileName || fileSize > 0) {
    validateFileMetadata({
      name: fileName || 'document.pdf',
      size: fileSize,
      type: mimeType,
    });
  }

  // 3. Validate PDF magic bytes and integrity
  const validatedBytes = validatePdfBuffer(buffer, fileName);

  options?.onProgress?.({
    stage: 'loading',
    percent: 15,
    message: 'Loading PDF structure...',
  });

  // 4. Perform native PDF text extraction
  const { pages: nativePages, metadata, pdfDoc } = await extractNativePdf(
    validatedBytes,
    options,
    fileName
  );

  if (nativePages.length === 0) {
    throw new EmptyExtractionError('The PDF document contains 0 readable pages.', {
      fileName,
    });
  }

  // 5. Evaluate each page for OCR fallback
  const finalPages: ExtractedPage[] = [];
  let ocrPageCount = 0;
  let nativePageCount = 0;

  for (let i = 0; i < nativePages.length; i++) {
    const nativePage = nativePages[i];
    const pageNum = nativePage.pageNumber;
    const requiresOcr = options?.forceOcr || nativePage.charCount < ocrThreshold;

    if (requiresOcr) {
      options?.onProgress?.({
        stage: 'ocr',
        currentPage: pageNum,
        totalPages: nativePages.length,
        percent: 50 + Math.round(((i + 1) / nativePages.length) * 45),
        message: `Running OCR on page ${pageNum} (sparse native text)...`,
      });

      try {
        const pageProxy = await pdfDoc.getPage(pageNum);
        const ocrPage = await performPageOcr(pageProxy, pageNum, options);

        // If forceOcr is explicitly set, or OCR returned more content, or native had nothing
        if (
          options?.forceOcr ||
          ocrPage.charCount > nativePage.charCount ||
          nativePage.charCount === 0
        ) {
          finalPages.push(ocrPage);
          ocrPageCount++;
        } else {
          finalPages.push(nativePage);
          if (nativePage.charCount > 0) {
            nativePageCount++;
          }
        }
      } catch (ocrErr: unknown) {
        // If OCR fails but we have some native text, keep native text
        if (nativePage.charCount > 0) {
          finalPages.push(nativePage);
          nativePageCount++;
        } else {
          // If no native text and OCR failed, rethrow
          throw ocrErr;
        }
      }
    } else {
      finalPages.push(nativePage);
      nativePageCount++;
    }
  }

  // 6. Determine overall extraction method
  let method: ExtractionMethod = 'native';
  if (ocrPageCount > 0 && nativePageCount > 0) {
    method = 'mixed';
  } else if (ocrPageCount > 0 && nativePageCount === 0) {
    method = 'ocr';
  }

  // 7. Combine text across all pages
  const combinedText = combinePageTexts(finalPages);
  const totalCharCount = combinedText.length;

  const extractedDoc: ExtractedDocument = {
    text: combinedText,
    pages: finalPages,
    method,
    metadata: {
      ...metadata,
      isScanned: ocrPageCount > 0,
    },
    totalCharCount,
  };

  // 8. Validate extracted output against schema
  const validatedDoc = validateExtractedDocument(extractedDoc);

  options?.onProgress?.({
    stage: 'completed',
    percent: 100,
    message: 'Document extraction completed successfully.',
  });

  return validatedDoc;
}
