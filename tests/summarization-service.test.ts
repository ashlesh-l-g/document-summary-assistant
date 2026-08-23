import { describe, it, expect, vi } from 'vitest';
import { summarizeDocument } from '@/lib/ai/summarization/summarization-service';
import {
  AISummarizationError,
  AIAuthenticationError,
  AIRateLimitError,
} from '@/types/errors';
import type {
  AIProvider,
  ChunkSummary,
  DocumentSummary,
  ChunkSummaryRequest,
  DocumentSynthesisRequest,
  SummarizationProgressStage,
} from '@/types/ai';
import type { ProcessedDocument } from '@/types/processing';

function createMockProcessedDoc(chunkTexts: string[]): ProcessedDocument {
  const chunks = chunkTexts.map((text, i) => ({
    id: `chunk-${i}`,
    index: i,
    text,
    startPage: i + 1,
    endPage: i + 1,
    pageNumbers: [i + 1],
    charCount: text.length,
    approximateTokenCount: Math.ceil(text.length / 4),
  }));

  return {
    chunks,
    totalChunks: chunks.length,
    totalCharCount: chunks.reduce((acc, c) => acc + c.charCount, 0),
    totalApproximateTokens: chunks.reduce((acc, c) => acc + c.approximateTokenCount, 0),
    metadata: {
      pageCount: chunks.length,
      fileName: 'research_paper.pdf',
      fileSizeBytes: 2048,
    },
    method: 'native',
    processingOptions: {
      targetChunkSize: 1500,
      maxChunkSize: 2500,
      minChunkSize: 200,
      overlap: 200,
    },
  };
}

function createMockProvider(overrides?: Partial<AIProvider>): AIProvider {
  return {
    name: 'nvidia',
    modelName: 'meta/llama-3.3-70b-instruct',
    summarizeChunk: vi.fn().mockImplementation(async (req: ChunkSummaryRequest): Promise<ChunkSummary> => {
      return {
        chunkId: req.chunk.id,
        startPage: req.chunk.startPage,
        endPage: req.chunk.endPage,
        pageNumbers: req.chunk.pageNumbers,
        summary: `Summary of ${req.chunk.id}`,
        keyPoints: [`Key point from ${req.chunk.id}`],
      };
    }),
    synthesizeSummary: vi.fn().mockImplementation(async (req: DocumentSynthesisRequest): Promise<DocumentSummary> => {
      return {
        title: 'Synthesized Document Title',
        overview: 'Comprehensive synthesized executive overview.',
        keyPoints: ['Major insight 1', 'Major insight 2'],
        sections: [
          {
            heading: 'Synthesis Section',
            content: 'Consolidated findings across all chunks.',
            sourcePages: [1],
            keyFindings: ['Finding A'],
          },
        ],
        sourceReferences: req.chunkSummaries.map((c) => ({
          pageNumber: c.startPage,
          chunkId: c.chunkId,
          relevance: `Reference for ${c.chunkId}`,
        })),
        metadata: {
          pageCount: req.chunkSummaries.length,
          totalChunks: req.chunkSummaries.length,
          provider: 'nvidia',
          model: 'meta/llama-3.3-70b-instruct',
          generatedAt: new Date().toISOString(),
          fileName: req.documentMetadata?.fileName,
        },
      };
    }),
    ...overrides,
  };
}

describe('Document Summarization Service', () => {
  it('throws AISummarizationError when processed document is empty or has 0 chunks', async () => {
    const emptyDoc: ProcessedDocument = {
      chunks: [],
      totalChunks: 0,
      totalCharCount: 0,
      totalApproximateTokens: 0,
      metadata: { pageCount: 0 },
      method: 'native',
      processingOptions: {
        targetChunkSize: 1500,
        maxChunkSize: 2500,
        minChunkSize: 200,
        overlap: 200,
      },
    };

    const mockProvider = createMockProvider();
    await expect(
      summarizeDocument(emptyDoc, { provider: mockProvider })
    ).rejects.toThrow(AISummarizationError);
  });

  it('summarizes a single-chunk document and synthesizes summary', async () => {
    const doc = createMockProcessedDoc(['Single chunk document content discussing AI architectures.']);
    const mockProvider = createMockProvider();

    const summary = await summarizeDocument(doc, { provider: mockProvider });

    expect(mockProvider.summarizeChunk).toHaveBeenCalledTimes(1);
    expect(mockProvider.synthesizeSummary).toHaveBeenCalledTimes(1);
    expect(summary.title).toBe('Synthesized Document Title');
    expect(summary.keyPoints).toHaveLength(2);
    expect(summary.sourceReferences).toHaveLength(1);
    expect(summary.sourceReferences[0].chunkId).toBe('chunk-0');
  });

  it('summarizes a multi-chunk document and preserves provenance across all chunks', async () => {
    const doc = createMockProcessedDoc([
      'First chunk detailing introduction and background.',
      'Second chunk detailing core methodologies and data.',
      'Third chunk detailing empirical results and benchmarks.',
      'Fourth chunk detailing concluding remarks and future work.',
    ]);

    const mockProvider = createMockProvider();
    const progressEvents: Array<{ stage: SummarizationProgressStage; current: number; total: number }> = [];

    const summary = await summarizeDocument(doc, {
      provider: mockProvider,
      maxConcurrency: 2,
      onProgress: (stage, current, total) => {
        progressEvents.push({ stage, current, total });
      },
    });

    expect(mockProvider.summarizeChunk).toHaveBeenCalledTimes(4);
    expect(mockProvider.synthesizeSummary).toHaveBeenCalledTimes(1);
    expect(summary.metadata.totalChunks).toBe(4);
    expect(summary.sourceReferences).toHaveLength(4);

    // Verify progress tracking
    const stages = progressEvents.map((e) => e.stage);
    expect(stages).toContain('validating');
    expect(stages).toContain('summarizing_chunks');
    expect(stages).toContain('synthesizing');
    expect(stages).toContain('completed');
  });

  it('enforces concurrency limits during chunk summarization', async () => {
    const doc = createMockProcessedDoc([
      'Chunk 1',
      'Chunk 2',
      'Chunk 3',
      'Chunk 4',
      'Chunk 5',
    ]);

    let activeRequests = 0;
    let maxObservedConcurrency = 0;

    const mockProvider = createMockProvider({
      summarizeChunk: vi.fn().mockImplementation(async (req) => {
        activeRequests++;
        maxObservedConcurrency = Math.max(maxObservedConcurrency, activeRequests);
        // Simulate async work
        await new Promise((resolve) => setTimeout(resolve, 20));
        activeRequests--;

        return {
          chunkId: req.chunk.id,
          startPage: req.chunk.startPage,
          endPage: req.chunk.endPage,
          pageNumbers: req.chunk.pageNumbers,
          summary: `Summary ${req.chunk.id}`,
          keyPoints: ['point'],
        };
      }),
    });

    await summarizeDocument(doc, {
      provider: mockProvider,
      maxConcurrency: 2,
    });

    expect(maxObservedConcurrency).toBeLessThanOrEqual(2);
  });

  it('retries on transient rate-limit errors and recovers successfully', async () => {
    const doc = createMockProcessedDoc(['Chunk for retry test']);

    let attempts = 0;
    const mockProvider = createMockProvider({
      summarizeChunk: vi.fn().mockImplementation(async (req) => {
        attempts++;
        if (attempts === 1) {
          throw new AIRateLimitError('Simulated 429 rate limit', 'nvidia', {
            retryAfterSeconds: 0.01,
          });
        }
        return {
          chunkId: req.chunk.id,
          startPage: 1,
          endPage: 1,
          pageNumbers: [1],
          summary: 'Recovered summary after retry',
          keyPoints: ['Point A'],
        };
      }),
    });

    const summary = await summarizeDocument(doc, {
      provider: mockProvider,
      maxRetries: 2,
      retryDelayMs: 10,
    });

    expect(attempts).toBe(2);
    expect(summary).toBeDefined();
  });

  it('does NOT retry non-retryable authentication errors', async () => {
    const doc = createMockProcessedDoc(['Chunk for auth failure']);

    let attempts = 0;
    const mockProvider = createMockProvider({
      summarizeChunk: vi.fn().mockImplementation(async () => {
        attempts++;
        throw new AIAuthenticationError('Invalid API Key', 'nvidia');
      }),
    });

    await expect(
      summarizeDocument(doc, {
        provider: mockProvider,
        maxRetries: 3,
      })
    ).rejects.toThrow(AIAuthenticationError);

    expect(attempts).toBe(1); // Fast failure without retries
  });
});
