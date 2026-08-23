import type { ProcessedDocument } from '@/types/processing';
import type {
  AIProvider,
  ChunkSummary,
  DocumentSummary,
  SummarizeDocumentOptions,
} from '@/types/ai';
import { AISummarizationError } from '@/types/errors';
import { withRetry } from '@/lib/ai/utils/retry';
import { asyncPool } from '@/lib/ai/utils/concurrency';
import { createAIProvider } from '@/lib/ai/factory';

export const DEFAULT_CONCURRENCY = 3;
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_RETRY_DELAY_MS = 500;
export const DEFAULT_TEMPERATURE = 0.2;

/**
 * High-level, provider-independent document summarization service.
 *
 * Coordinates:
 * 1. ProcessedDocument validation
 * 2. Single-chunk fast path (1 direct synthesis request) OR concurrent chunk-level summarization with transient-fault retries
 * 3. Document-level synthesis deduplicating and grouping themes
 * 4. Provenance preservation and final schema validation
 */
export async function summarizeDocument(
  processedDoc: ProcessedDocument,
  options?: SummarizeDocumentOptions
): Promise<DocumentSummary> {
  // 1. Input Validation
  if (!processedDoc || !processedDoc.chunks || processedDoc.chunks.length === 0) {
    throw new AISummarizationError(
      'Cannot summarize document: Processed document contains 0 chunks.',
      { stage: 'validation' }
    );
  }

  const maxConcurrency = options?.maxConcurrency ?? DEFAULT_CONCURRENCY;
  const maxRetries = options?.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelayMs = options?.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  const temperature = options?.temperature ?? DEFAULT_TEMPERATURE;
  const signal = options?.signal;

  // 2. Resolve AI Provider (injected or factory-generated)
  const provider: AIProvider = options?.provider || createAIProvider();

  options?.onProgress?.('validating', 0, processedDoc.chunks.length);

  const documentTitle = processedDoc.metadata?.title || processedDoc.metadata?.fileName;
  const totalChunks = processedDoc.chunks.length;

  // Fast path for single-chunk documents: Skip intermediate chunk summarization and synthesize directly in 1 LLM call
  if (totalChunks === 1) {
    const singleChunk = processedDoc.chunks[0];
    options?.onProgress?.('synthesizing', 0, 1);

    if (signal?.aborted) {
      throw new AISummarizationError('Summarization operation was aborted.', {
        stage: 'synthesizing',
      });
    }

    const documentSummary = await withRetry(
      async () => {
        return await provider.synthesizeSummary({
          chunkSummaries: [
            {
              chunkId: singleChunk.id,
              startPage: singleChunk.startPage,
              endPage: singleChunk.endPage,
              pageNumbers: singleChunk.pageNumbers,
              summary: singleChunk.text,
              keyPoints: [],
            },
          ],
          documentTitle,
          documentMetadata: processedDoc.metadata,
          options: {
            temperature,
            signal,
          },
        });
      },
      {
        maxRetries,
        baseDelayMs,
      }
    );

    options?.onProgress?.('completed', 1, 1);
    return documentSummary;
  }

  let completedChunks = 0;

  // 3. Concurrent Chunk Summarization for multi-chunk documents
  const chunkSummaries: ChunkSummary[] = await asyncPool(
    maxConcurrency,
    processedDoc.chunks,
    async (chunk) => {
      if (signal?.aborted) {
        throw new AISummarizationError('Summarization operation was aborted.', {
          stage: 'summarizing_chunks',
        });
      }

      const summary = await withRetry(
        async () => {
          return await provider.summarizeChunk({
            chunk,
            documentTitle,
            options: {
              temperature,
              signal,
            },
          });
        },
        {
          maxRetries,
          baseDelayMs,
        }
      );

      completedChunks++;
      options?.onProgress?.('summarizing_chunks', completedChunks, totalChunks);

      return summary;
    }
  );

  if (chunkSummaries.length === 0) {
    throw new AISummarizationError(
      'Chunk summarization produced 0 valid chunk summaries.',
      { stage: 'summarizing_chunks' }
    );
  }

  // 4. Document-Level Synthesis for multi-chunk documents
  options?.onProgress?.('synthesizing', 0, 1);

  if (signal?.aborted) {
    throw new AISummarizationError('Summarization operation was aborted.', {
      stage: 'synthesizing',
    });
  }

  const documentSummary: DocumentSummary = await withRetry(
    async () => {
      return await provider.synthesizeSummary({
        chunkSummaries,
        documentTitle,
        documentMetadata: processedDoc.metadata,
        options: {
          temperature,
          signal,
        },
      });
    },
    {
      maxRetries,
      baseDelayMs,
    }
  );

  options?.onProgress?.('completed', 1, 1);

  return documentSummary;
}
