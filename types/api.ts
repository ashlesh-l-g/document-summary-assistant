import type { DocumentSummary } from './ai';
import type { ExtractionMethod } from './document';

/**
 * Metadata about the document text extraction phase
 */
export interface ExtractionMetadataResponse {
  readonly method: ExtractionMethod;
  readonly pageCount: number;
  readonly isScanned: boolean;
  readonly totalCharCount: number;
  readonly fileName?: string;
  readonly fileSizeBytes?: number;
}

/**
 * Metadata about the document chunking and token processing phase
 */
export interface ProcessingMetadataResponse {
  readonly totalChunks: number;
  readonly totalApproximateTokens: number;
  readonly totalCharCount: number;
}

/**
 * Success response payload returned by POST /api/documents/summarize
 */
export interface SummarizeDocumentResponse {
  readonly success: true;
  readonly summary: DocumentSummary;
  readonly extraction: ExtractionMetadataResponse;
  readonly processing: ProcessingMetadataResponse;
}

/**
 * Standardized error payload structure
 */
export interface ApiErrorPayload {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

/**
 * Failure response payload returned by API routes
 */
export interface ApiErrorResponse {
  readonly success: false;
  readonly error: ApiErrorPayload;
}

export type SummarizeApiResponse = SummarizeDocumentResponse | ApiErrorResponse;
