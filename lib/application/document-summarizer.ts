import type {
  AIProvider,
  ExtractionOptions,
  ProcessingOptions,
  SummarizeDocumentOptions,
  SummarizeDocumentResponse,
} from '@/types';
import { EmptyFileError } from '@/types/errors';
import { extractDocument } from '@/lib/extraction';
import { processDocument } from '@/lib/processing';
import { summarizeDocument } from '@/lib/ai';

export interface SummarizeDocumentFileOptions {
  /** Optional custom or injected AIProvider (if omitted, factory resolves via env) */
  readonly provider?: AIProvider;
  /** Extraction configuration overrides */
  readonly extractionOptions?: ExtractionOptions;
  /** Processing / chunking configuration overrides */
  readonly processingOptions?: ProcessingOptions;
  /** Summarization execution options (concurrency, retries, temperature, signal, progress) */
  readonly aiOptions?: Omit<SummarizeDocumentOptions, 'provider'>;
}

/**
 * Application service that orchestrates the entire Document Summary Assistant workflow:
 *
 * File / Upload
 *     ↓
 * 1. Extraction (PDF.js + OCR fallback)
 *     ↓
 * 2. Processing (Hierarchical chunking + page metadata preservation)
 *     ↓
 * 3. AI Summarization (Provider factory -> concurrent chunk summaries -> synthesis)
 *     ↓
 * 4. Structured Response (DocumentSummary + extraction metadata + processing metadata)
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

  // 2. Process and hierarchically chunk the extracted text
  const processedDoc = processDocument(extractedDoc, options?.processingOptions);

  // 3. Execute AI chunk summarization and document-level synthesis
  const summary = await summarizeDocument(processedDoc, {
    provider: options?.provider,
    ...options?.aiOptions,
  });

  // 4. Assemble clean, structured application response
  return {
    success: true,
    summary,
    extraction: {
      method: extractedDoc.method,
      pageCount: extractedDoc.metadata.pageCount,
      isScanned: extractedDoc.metadata.isScanned ?? false,
      totalCharCount: extractedDoc.totalCharCount,
      fileName: extractedDoc.metadata.fileName,
      fileSizeBytes: extractedDoc.metadata.fileSizeBytes,
    },
    processing: {
      totalChunks: processedDoc.totalChunks,
      totalApproximateTokens: processedDoc.totalApproximateTokens,
      totalCharCount: processedDoc.totalCharCount,
    },
  };
}
