import type {
  AIProvider,
  ExtractedDocument,
  ExtractionOptions,
  ProcessingOptions,
  SummarizeDocumentOptions,
  SummarizeDocumentResponse,
} from '@/types';
import { EmptyExtractionError, EmptyFileError } from '@/types/errors';
import { extractDocument } from '@/lib/extraction';
import { processDocument } from '@/lib/processing';
import { summarizeDocument } from '@/lib/ai';
import { validateExtractedDocument } from '@/lib/validation/document-validation';

export interface SummarizeExtractedDocumentOptions {
  /** Optional custom or injected AIProvider (if omitted, factory resolves via env) */
  readonly provider?: AIProvider;
  /** Processing / chunking configuration overrides */
  readonly processingOptions?: ProcessingOptions;
  /** Summarization execution options (concurrency, retries, temperature, signal, progress) */
  readonly aiOptions?: Omit<SummarizeDocumentOptions, 'provider'>;
}

export interface SummarizeDocumentFileOptions extends SummarizeExtractedDocumentOptions {
  /** Extraction configuration overrides */
  readonly extractionOptions?: ExtractionOptions;
}

/**
 * Summarize an already-extracted document representation (e.g. extracted client-side via PDF.js/Tesseract).
 */
export async function summarizeExtractedDocument(
  doc: ExtractedDocument,
  options?: SummarizeExtractedDocumentOptions
): Promise<SummarizeDocumentResponse> {
  if (!doc) {
    throw new EmptyExtractionError('No extracted document was provided for summarization.');
  }

  // 1. Validate extracted document schema
  const validatedDoc = validateExtractedDocument(doc);

  // 2. Process and hierarchically chunk the extracted text
  const processedDoc = processDocument(validatedDoc, options?.processingOptions);

  // 3. Execute AI summarization (fast-path for 1 chunk or concurrent chunk summaries + synthesis)
  const summary = await summarizeDocument(processedDoc, {
    provider: options?.provider,
    ...options?.aiOptions,
  });

  // 4. Assemble clean, structured application response
  return {
    success: true,
    summary,
    extraction: {
      method: validatedDoc.method,
      pageCount: validatedDoc.metadata.pageCount,
      isScanned: validatedDoc.metadata.isScanned ?? false,
      totalCharCount: validatedDoc.totalCharCount,
      fileName: validatedDoc.metadata.fileName,
      fileSizeBytes: validatedDoc.metadata.fileSizeBytes,
    },
    processing: {
      totalChunks: processedDoc.totalChunks,
      totalApproximateTokens: processedDoc.totalApproximateTokens,
      totalCharCount: processedDoc.totalCharCount,
    },
  };
}

/**
 * Application service that orchestrates the entire Document Summary Assistant workflow from a file:
 *
 * File / Upload
 *     ↓
 * 1. Extraction (PDF.js + OCR fallback)
 *     ↓
 * 2. Summarize Extracted Document (Processing -> AI Summarization -> Response)
 */
export async function summarizeDocumentFile(
  file: File | Blob,
  options?: SummarizeDocumentFileOptions
): Promise<SummarizeDocumentResponse> {
  if (!file) {
    throw new EmptyFileError('No file was provided for summarization.');
  }

  // 1. Ingest & Extract document text and metadata
  const extractedDoc = await extractDocument(file, options?.extractionOptions);

  // 2. Delegate to summarizeExtractedDocument
  return summarizeExtractedDocument(extractedDoc, options);
}
