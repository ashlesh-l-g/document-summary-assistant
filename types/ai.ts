import type { DocumentMetadata } from './document';
import type { DocumentChunk } from './processing';

/**
 * Supported AI Providers
 */
export type AIProviderName = 'groq' | 'nvidia' | 'gemini';

/**
 * Provenance reference pointing back to a specific document page and chunk
 */
export interface SourceReference {
  readonly pageNumber: number;
  readonly chunkId: string;
  readonly relevance?: string;
  readonly quote?: string;
}

/**
 * Structured thematic section within the synthesized summary
 */
export interface SummarySection {
  readonly heading: string;
  readonly content: string;
  readonly sourcePages?: readonly number[];
  readonly keyFindings?: readonly string[];
}

/**
 * Summary representation for an individual document chunk
 */
export interface ChunkSummary {
  readonly chunkId: string;
  readonly startPage: number;
  readonly endPage: number;
  readonly pageNumbers: readonly number[];
  readonly summary: string;
  readonly keyPoints: readonly string[];
  readonly topics?: readonly string[];
}

/**
 * Metadata recorded with the generated document summary
 */
export interface DocumentSummaryMetadata {
  readonly pageCount: number;
  readonly totalChunks: number;
  readonly provider: AIProviderName;
  readonly model: string;
  readonly generatedAt: string;
  readonly fileName?: string;
  readonly fileSizeBytes?: number;
  readonly isScanned?: boolean;
}

/**
 * Final synthesized, structured document summary
 */
export interface DocumentSummary {
  readonly title: string;
  readonly overview: string;
  readonly keyPoints: readonly string[];
  readonly sections: readonly SummarySection[];
  readonly sourceReferences: readonly SourceReference[];
  readonly metadata: DocumentSummaryMetadata;
}

/**
 * Request options passed to model invocations
 */
export interface AIOptions {
  readonly temperature?: number;
  readonly maxOutputTokens?: number;
  readonly signal?: AbortSignal;
}

/**
 * Request payload for summarizing a single chunk
 */
export interface ChunkSummaryRequest {
  readonly chunk: DocumentChunk;
  readonly documentTitle?: string;
  readonly options?: AIOptions;
}

/**
 * Request payload for synthesizing all chunk summaries into a document summary
 */
export interface DocumentSynthesisRequest {
  readonly chunkSummaries: readonly ChunkSummary[];
  readonly documentTitle?: string;
  readonly documentMetadata?: DocumentMetadata;
  readonly options?: AIOptions;
}

/**
 * Provider-neutral AI interface implemented by all providers (NVIDIA, Gemini, etc.)
 */
export interface AIProvider {
  readonly name: AIProviderName;
  readonly modelName: string;

  summarizeChunk(request: ChunkSummaryRequest): Promise<ChunkSummary>;

  synthesizeSummary(request: DocumentSynthesisRequest): Promise<DocumentSummary>;
}

/**
 * Configuration for instantiating an AI provider
 */
export interface AIProviderConfig {
  readonly provider: AIProviderName;
  readonly apiKey: string;
  readonly model?: string;
  readonly baseURL?: string;
}

/**
 * Progress stages during the summarization lifecycle
 */
export type SummarizationProgressStage =
  | 'validating'
  | 'summarizing_chunks'
  | 'synthesizing'
  | 'completed';

/**
 * Options for the top-level Summarization Service
 */
export interface SummarizeDocumentOptions {
  /** Optional custom/injected provider. If omitted, initialized via createAIProvider(). */
  readonly provider?: AIProvider;
  /** Maximum concurrent chunk summarization requests (default: 3) */
  readonly maxConcurrency?: number;
  /** Maximum retry attempts for transient failures (default: 3) */
  readonly maxRetries?: number;
  /** Base delay between retries in milliseconds (default: 500) */
  readonly retryDelayMs?: number;
  /** Sampling temperature (default: 0.2) */
  readonly temperature?: number;
  /** Cancellation signal */
  readonly signal?: AbortSignal;
  /** Progress callback */
  readonly onProgress?: (
    stage: SummarizationProgressStage,
    current: number,
    total: number
  ) => void;
}
