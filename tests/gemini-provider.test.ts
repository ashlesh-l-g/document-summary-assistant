import { describe, it, expect, vi } from 'vitest';
import { GeminiProvider, type GeminiClientLike } from '@/lib/ai/providers/gemini-provider';
import {
  AIAuthenticationError,
  AIRateLimitError,
  AIProviderError,
  AIResponseValidationError,
} from '@/types/errors';
import type { ChunkSummaryRequest, DocumentSynthesisRequest } from '@/types/ai';

const sampleChunk: ChunkSummaryRequest['chunk'] = {
  id: 'chunk-1',
  index: 1,
  text: 'Technical architecture specifications describing modular pipeline decomposition and strict provider isolation.',
  startPage: 2,
  endPage: 2,
  pageNumbers: [2],
  charCount: 110,
  approximateTokenCount: 28,
};

describe('Gemini Provider', () => {
  it('constructs correct generation request and parses chunk summary', async () => {
    let capturedParams: unknown;

    const mockClient: GeminiClientLike = {
      models: {
        generateContent: vi.fn().mockImplementation((params) => {
          capturedParams = params;
          return Promise.resolve({
            text: JSON.stringify({
              summary: 'Architecture specifies modular pipeline and provider isolation.',
              keyPoints: ['Modular decomposition', 'Strict isolation'],
              topics: ['Architecture', 'Engineering'],
            }),
          });
        }),
      },
    };

    const provider = new GeminiProvider({
      model: 'gemini-2.5-flash',
      customClient: mockClient,
    });

    const result = await provider.summarizeChunk({
      chunk: sampleChunk,
      documentTitle: 'System Design Doc',
      options: { temperature: 0.3 },
    });

    const params = capturedParams as {
      model: string;
      contents: string;
      config: {
        systemInstruction: string;
        responseMimeType: string;
        temperature: number;
      };
    };

    expect(params.model).toBe('gemini-2.5-flash');
    expect(params.config.responseMimeType).toBe('application/json');
    expect(params.config.temperature).toBe(0.3);
    expect(params.config.systemInstruction).toContain('analytical document summarization assistant');

    expect(result.chunkId).toBe('chunk-1');
    expect(result.summary).toContain('Architecture specifies');
    expect(result.keyPoints).toHaveLength(2);
  });

  it('synthesizes document summary successfully from chunk summaries', async () => {
    const mockClient: GeminiClientLike = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: JSON.stringify({
            title: 'System Design Summary',
            overview: 'Comprehensive overview of the modular architecture.',
            keyPoints: ['Clean separation of concerns', 'Isolated AI providers'],
            sections: [
              {
                heading: 'Core Architecture',
                content: 'The system uses an ingestion-processing-AI pipeline.',
                sourcePages: [2],
                keyFindings: ['Modularity achieved'],
              },
            ],
          }),
        }),
      },
    };

    const provider = new GeminiProvider({
      customClient: mockClient,
    });

    const request: DocumentSynthesisRequest = {
      chunkSummaries: [
        {
          chunkId: 'chunk-1',
          startPage: 2,
          endPage: 2,
          pageNumbers: [2],
          summary: 'Architecture chunk summary',
          keyPoints: ['Modular design'],
        },
      ],
      documentTitle: 'System Design Doc',
    };

    const summary = await provider.synthesizeSummary(request);
    expect(summary.title).toBe('System Design Summary');
    expect(summary.overview).toContain('Comprehensive overview');
    expect(summary.keyPoints).toHaveLength(2);
    expect(summary.sections).toHaveLength(1);
    expect(summary.metadata.provider).toBe('gemini');
  });

  it('maps API_KEY_INVALID / 401 error to AIAuthenticationError', async () => {
    const mockClient: GeminiClientLike = {
      models: {
        generateContent: vi.fn().mockRejectedValue(
          new Error('API_KEY_INVALID: The provided Gemini API key is not valid.')
        ),
      },
    };

    const provider = new GeminiProvider({
      customClient: mockClient,
    });

    await expect(
      provider.summarizeChunk({ chunk: sampleChunk })
    ).rejects.toThrow(AIAuthenticationError);
  });

  it('maps RESOURCE_EXHAUSTED / quota limit error to AIRateLimitError', async () => {
    const mockClient: GeminiClientLike = {
      models: {
        generateContent: vi.fn().mockRejectedValue(
          new Error('RESOURCE_EXHAUSTED: Quota exceeded for quota metric GenerateContent.')
        ),
      },
    };

    const provider = new GeminiProvider({
      customClient: mockClient,
    });

    await expect(
      provider.summarizeChunk({ chunk: sampleChunk })
    ).rejects.toThrow(AIRateLimitError);
  });

  it('maps 503 UNAVAILABLE to retryable AIProviderError', async () => {
    const mockClient: GeminiClientLike = {
      models: {
        generateContent: vi.fn().mockRejectedValue(
          new Error('503 Service Unavailable: The model is currently overloaded.')
        ),
      },
    };

    const provider = new GeminiProvider({
      customClient: mockClient,
    });

    try {
      await provider.summarizeChunk({ chunk: sampleChunk });
      expect.unreachable();
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(AIProviderError);
      const providerErr = err as AIProviderError;
      expect(providerErr.isRetryable).toBe(true);
    }
  });

  it('throws AIResponseValidationError on malformed JSON returned by Gemini', async () => {
    const mockClient: GeminiClientLike = {
      models: {
        generateContent: vi.fn().mockResolvedValue({
          text: 'This is plain conversational text without JSON.',
        }),
      },
    };

    const provider = new GeminiProvider({
      customClient: mockClient,
    });

    await expect(
      provider.summarizeChunk({ chunk: sampleChunk })
    ).rejects.toThrow(AIResponseValidationError);
  });
});
