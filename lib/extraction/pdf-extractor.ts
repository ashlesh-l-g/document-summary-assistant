import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  CorruptDocumentError,
  PasswordProtectedDocumentError,
  DocumentExtractionError,
} from '@/types/errors';
import type {
  ExtractedPage,
  DocumentMetadata,
  ExtractionOptions,
} from '@/types/document';
import { normalizeExtractedText } from './text-normalizer';

// Initialize PDF.js worker from local static asset if running in browser
if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export interface PdfNativeExtractionResult {
  pages: ExtractedPage[];
  metadata: DocumentMetadata;
  pdfDoc: pdfjsLib.PDFDocumentProxy;
}

/**
 * Extract text from a single PDF page proxy
 */
export async function extractTextFromPage(
  page: pdfjsLib.PDFPageProxy,
  pageNumber: number
): Promise<ExtractedPage> {
  const textContent = await page.getTextContent();
  let lastY: number | undefined;
  let pageText = '';

  for (const item of textContent.items) {
    if ('str' in item && typeof item.str === 'string') {
      const currentY = Array.isArray(item.transform) ? item.transform[5] : undefined;

      if (lastY !== undefined && currentY !== undefined && Math.abs(currentY - lastY) > 6) {
        if (!pageText.endsWith('\n')) {
          pageText += '\n';
        }
      } else if (
        pageText.length > 0 &&
        !pageText.endsWith('\n') &&
        !pageText.endsWith(' ') &&
        item.str.trim().length > 0
      ) {
        pageText += ' ';
      }

      pageText += item.str;

      if (item.hasEOL) {
        pageText += '\n';
      }

      if (currentY !== undefined) {
        lastY = currentY;
      }
    }
  }

  const normalized = normalizeExtractedText(pageText);

  return {
    pageNumber,
    text: normalized,
    method: 'native',
    charCount: normalized.length,
    isScanned: normalized.length === 0,
  };
}

/**
 * Extract metadata from a PDF Document Proxy
 */
export async function extractPdfMetadata(
  pdfDoc: pdfjsLib.PDFDocumentProxy,
  fileName?: string,
  fileSizeBytes?: number
): Promise<DocumentMetadata> {
  let title: string | undefined;
  let author: string | undefined;
  let creator: string | undefined;
  let producer: string | undefined;
  let creationDate: string | undefined;

  try {
    const meta = await pdfDoc.getMetadata();
    const info = (meta?.info || {}) as Record<string, unknown>;

    if (typeof info.Title === 'string' && info.Title.trim().length > 0) {
      title = info.Title.trim();
    }
    if (typeof info.Author === 'string' && info.Author.trim().length > 0) {
      author = info.Author.trim();
    }
    if (typeof info.Creator === 'string' && info.Creator.trim().length > 0) {
      creator = info.Creator.trim();
    }
    if (typeof info.Producer === 'string' && info.Producer.trim().length > 0) {
      producer = info.Producer.trim();
    }
    if (info.CreationDate) {
      creationDate = String(info.CreationDate);
    }
  } catch {
    // Non-fatal: metadata extraction failure should not abort document reading
  }

  return {
    pageCount: pdfDoc.numPages,
    fileName,
    fileSizeBytes,
    mimeType: 'application/pdf',
    title,
    author,
    creator,
    producer,
    creationDate,
  };
}

/**
 * Load PDF document and extract native text across all pages
 */
export async function extractNativePdf(
  data: Uint8Array | ArrayBuffer,
  options?: ExtractionOptions,
  fileName?: string
): Promise<PdfNativeExtractionResult> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);

  let loadingTask: pdfjsLib.PDFDocumentLoadingTask;

  try {
    loadingTask = pdfjsLib.getDocument({
      data: bytes,
      useSystemFonts: true,
      stopAtErrors: false,
      isEvalSupported: false,
    });
  } catch (err: unknown) {
    throw new CorruptDocumentError(
      'Failed to initialize PDF parser. File structure may be invalid.',
      { fileName },
      err
    );
  }

  let pdfDoc: pdfjsLib.PDFDocumentProxy;

  try {
    pdfDoc = await loadingTask.promise;
  } catch (err: unknown) {
    const errorObj = err as { name?: string; message?: string };
    if (errorObj?.name === 'PasswordException') {
      throw new PasswordProtectedDocumentError(
        'Document is password-protected. Please unlock the PDF before uploading.',
        { fileName }
      );
    }
    if (
      errorObj?.name === 'InvalidPDFException' ||
      errorObj?.name === 'FormatError' ||
      errorObj?.message?.includes('Invalid PDF')
    ) {
      throw new CorruptDocumentError(
        'Corrupt or invalid PDF file header / structure.',
        { fileName, reason: errorObj.message },
        err
      );
    }
    throw new DocumentExtractionError(
      `Failed to parse PDF: ${errorObj?.message || 'Unknown error'}`,
      'EXTRACTION_FAILED',
      { fileName },
      err
    );
  }

  const totalPages = pdfDoc.numPages;
  const maxPagesToProcess = options?.maxPages
    ? Math.min(options.maxPages, totalPages)
    : totalPages;

  const metadata = await extractPdfMetadata(pdfDoc, fileName, bytes.byteLength);
  const pages: ExtractedPage[] = [];

  for (let pageNum = 1; pageNum <= maxPagesToProcess; pageNum++) {
    options?.onProgress?.({
      stage: 'extracting',
      currentPage: pageNum,
      totalPages: maxPagesToProcess,
      percent: Math.round((pageNum / maxPagesToProcess) * 50),
      message: `Extracting text from page ${pageNum} of ${maxPagesToProcess}...`,
    });

    const pageProxy = await pdfDoc.getPage(pageNum);
    const extractedPage = await extractTextFromPage(pageProxy, pageNum);
    pages.push(extractedPage);
  }

  return {
    pages,
    metadata,
    pdfDoc,
  };
}
