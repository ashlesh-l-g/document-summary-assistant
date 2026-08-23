import type { DocumentMetadata, ExtractionMethod } from './document';

/**
 * Document Summary Assistant - Processing & Chunking Types
 */

export interface DocumentChunk {
  /** Deterministic chunk identifier, e.g. "chunk-0", "chunk-1" */
  readonly id: string;
  /** 0-based chunk sequence index */
  readonly index: number;
  /** Normalized chunk text */
  readonly text: string;
  /** First document page number where this chunk's content originates (1-based) */
  readonly startPage: number;
  /** Last document page number where this chunk's content originates (1-based) */
  readonly endPage: number;
  /** Sorted list of all unique page numbers included in this chunk */
  readonly pageNumbers: readonly number[];
  /** Total characters in the chunk text */
  readonly charCount: number;
  /** Deterministic estimate of token count */
  readonly approximateTokenCount: number;
}

export interface ProcessingOptions {
  /**
   * Target chunk size in characters.
   * Default: 1500 (approx. 375 tokens)
   */
  readonly targetChunkSize?: number;

  /**
   * Hard ceiling for maximum chunk size in characters.
   * Default: 2500 (approx. 625 tokens)
   */
  readonly maxChunkSize?: number;

  /**
   * Minimum chunk size in characters before a chunk is closed or merged.
   * Default: 200 (approx. 50 tokens)
   */
  readonly minChunkSize?: number;

  /**
   * Number of overlapping characters preserved between consecutive chunks.
   * Default: 200 (approx. 50 tokens)
   */
  readonly overlap?: number;
}

export interface ProcessedDocument {
  /** Optional document ID or identifier */
  readonly documentId?: string;
  /** Ordered list of LLM-ready chunks */
  readonly chunks: readonly DocumentChunk[];
  /** Total number of chunks generated */
  readonly totalChunks: number;
  /** Combined total characters across all chunks */
  readonly totalCharCount: number;
  /** Combined total approximate tokens across all chunks */
  readonly totalApproximateTokens: number;
  /** Original document metadata */
  readonly metadata: DocumentMetadata;
  /** Extraction method used */
  readonly method: ExtractionMethod;
  /** Resolved configuration used to generate this processed document */
  readonly processingOptions: Required<ProcessingOptions>;
}
