import type * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { OcrProcessingError } from '@/types/errors';
import type {
  ExtractedPage,
  ExtractionOptions,
  OcrImageRecognizer,
} from '@/types/document';
import { normalizeExtractedText } from './text-normalizer';

/**
 * Render a PDF page proxy onto a canvas element
 */
export async function renderPageToCanvas(
  page: pdfjsLib.PDFPageProxy,
  scale = 2.0
): Promise<HTMLCanvasElement> {
  if (typeof document === 'undefined') {
    throw new OcrProcessingError(
      'Canvas rendering is only supported in a browser environment or with a canvas polyfill.'
    );
  }

  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  const context = canvas.getContext('2d');
  if (!context) {
    throw new OcrProcessingError('Failed to acquire 2D canvas rendering context.');
  }

  const renderTask = page.render({
    canvasContext: context,
    viewport,
    canvas,
  });

  await renderTask.promise;
  return canvas;
}

/**
 * Default OCR recognizer using Tesseract.js in browser/runtime
 */
export const defaultTesseractRecognizer: OcrImageRecognizer = async (
  imageSource,
  options
) => {
  const language = options?.language || 'eng';

  try {
    // Dynamic import to keep Tesseract bundle segregated
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker(language);
    const ret = await worker.recognize(imageSource as string | HTMLCanvasElement);
    await worker.terminate();

    return {
      text: ret.data.text,
      confidence: ret.data.confidence,
    };
  } catch (err: unknown) {
    throw new OcrProcessingError(
      `Tesseract OCR execution failed: ${err instanceof Error ? err.message : 'Unknown OCR error'}`,
      { pageNumber: options?.pageNumber, language },
      err
    );
  }
};

/**
 * Perform OCR on a single PDF page proxy
 */
export async function performPageOcr(
  page: pdfjsLib.PDFPageProxy,
  pageNumber: number,
  options?: ExtractionOptions
): Promise<ExtractedPage> {
  const recognizer = options?.customOcrRecognizer || defaultTesseractRecognizer;

  try {
    let result: { text: string; confidence?: number };

    if (options?.customOcrRecognizer) {
      // In testing or custom environment, custom recognizer can take page or placeholder
      result = await recognizer(`[Page ${pageNumber} Scan]`, {
        language: options.ocrLanguage || 'eng',
        pageNumber,
      });
    } else {
      const canvas = await renderPageToCanvas(page, 2.0);
      result = await recognizer(canvas, {
        language: options?.ocrLanguage || 'eng',
        pageNumber,
      });
    }

    const normalized = normalizeExtractedText(result.text);

    return {
      pageNumber,
      text: normalized,
      method: 'ocr',
      charCount: normalized.length,
      confidence: result.confidence,
      isScanned: true,
    };
  } catch (err: unknown) {
    if (err instanceof OcrProcessingError) {
      throw err;
    }
    throw new OcrProcessingError(
      `OCR extraction failed on page ${pageNumber}`,
      { pageNumber },
      err
    );
  }
}
