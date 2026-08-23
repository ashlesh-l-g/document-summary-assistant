import { describe, it, expect, vi } from 'vitest';
import { NVIDIAProvider } from '@/lib/ai/providers/nvidia-provider';
import {
  AIAuthenticationError,
  AIRateLimitError,
  AIProviderError,
  AIResponseValidationError,
} from '@/types/errors';
import type { ChunkSummaryRequest, DocumentSynthesisRequest } from '@/types/ai';

const sampleChunk: ChunkSummaryRequest['chunk'] = {
  id: 'chunk-0',
  index: 0,
  text: 'Quarterly financial results for Q3 2024 showing total revenue of $4.2 billion with 18% YoY growth.',
  startPage: 1,
  endPage: 1,
  pageNumbers: [1],
  charCount: 99,
  approximateTokenCount: 25,
};

describe('NVIDIA Provider', () => {
  it('constructs correct HTTP request payload and headers', async () => {
    let capturedUrl = '';
    let capturedInit: RequestInit | undefined;

    const mockFetch = vi.fn().mockImplementation((url, init) => {
      capturedUrl = String(url);
      capturedInit = init;

      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                summary: 'Q3 2024 revenue reached $4.2B with 18% YoY growth.',
                keyPoints: ['Revenue: $4.2B', 'Growth: 18% YoY'],
                topics: ['Finance', 'Earnings'],
              }),
            },
          },
        ],
      };

      return Promise.resolve(new Response(JSON.stringify(mockResponse), { status: 200 }));
    });

    const provider = new NVIDIAProvider({
      apiKey: 'nvapi-secret-key-12345',
      model: 'meta/llama-3.3-70b-instruct',
      customFetch: mockFetch as unknown as typeof fetch,
    });

    const result = await provider.summarizeChunk({
      chunk: sampleChunk,
      documentTitle: 'Financial Report',
      options: { temperature: 0.1 },
    });

    expect(capturedUrl).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    expect(capturedInit?.method).toBe('POST');
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer nvapi-secret-key-12345');
    expect(headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(String(capturedInit?.body));
    expect(body.model).toBe('meta/llama-3.3-70b-instruct');
    expect(body.temperature).toBe(0.1);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages).toHaveLength(2);

    expect(result.chunkId).toBe('chunk-0');
    expect(result.startPage).toBe(1);
    expect(result.summary).toContain('$4.2B');
    expect(result.keyPoints).toHaveLength(2);
  });

  it('synthesizes document summary successfully from chunk summaries', async () => {
    const mockResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify({
              title: 'Executive Financial Summary',
              overview: 'Comprehensive overview of quarterly revenue and growth metrics.',
              keyPoints: ['Overall growth was robust at 18%', 'Strong margins across sectors'],
              sections: [
                {
                  heading: 'Financial Performance',
                  content: 'Detailed performance breakdown.',
                  sourcePages: [1],
                  keyFindings: ['Revenue beat expectations'],
                },
              ],
              sourceReferences: [
                {
                  pageNumber: 1,
                  chunkId: 'chunk-0',
                  relevance: 'Quarterly financial metrics',
                },
              ],
            }),
          },
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 })
    );

    const provider = new NVIDIAProvider({
      apiKey: 'nvapi-key',
      customFetch: mockFetch as unknown as typeof fetch,
    });

    const request: DocumentSynthesisRequest = {
      chunkSummaries: [
        {
          chunkId: 'chunk-0',
          startPage: 1,
          endPage: 1,
          pageNumbers: [1],
          summary: 'Q3 revenue summary',
          keyPoints: ['18% growth'],
        },
      ],
      documentTitle: 'Financial Report',
    };

    const summary = await provider.synthesizeSummary(request);
    expect(summary.title).toBe('Executive Financial Summary');
    expect(summary.overview).toContain('Comprehensive overview');
    expect(summary.keyPoints).toHaveLength(2);
    expect(summary.sections).toHaveLength(1);
    expect(summary.metadata.provider).toBe('nvidia');
  });

  it('maps HTTP 401/403 to AIAuthenticationError without leaking API key', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('{"error": "Unauthorized"}', { status: 401 })
    );

    const provider = new NVIDIAProvider({
      apiKey: 'my-super-secret-key-123',
      customFetch: mockFetch as unknown as typeof fetch,
    });

    await expect(
      provider.summarizeChunk({ chunk: sampleChunk })
    ).rejects.toThrow(AIAuthenticationError);

    try {
      await provider.summarizeChunk({ chunk: sampleChunk });
    } catch (err: unknown) {
      const errorMsg = String(err);
      expect(errorMsg).not.toContain('my-super-secret-key-123');
    }
  });

  it('maps HTTP 429 with retry-after header to AIRateLimitError', async () => {
    const headers = new Headers({ 'retry-after': '12' });
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('{"error": "Rate limit exceeded"}', { status: 429, headers })
    );

    const provider = new NVIDIAProvider({
      apiKey: 'nvapi-key',
      customFetch: mockFetch as unknown as typeof fetch,
    });

    try {
      await provider.summarizeChunk({ chunk: sampleChunk });
      expect.unreachable();
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(AIRateLimitError);
      const rateLimitErr = err as AIRateLimitError;
      expect(rateLimitErr.retryAfterSeconds).toBe(12);
      expect(rateLimitErr.provider).toBe('nvidia');
    }
  });

  it('maps HTTP 500 to retryable AIProviderError', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('Internal Server Error', { status: 500 })
    );

    const provider = new NVIDIAProvider({
      apiKey: 'nvapi-key',
      customFetch: mockFetch as unknown as typeof fetch,
    });

    try {
      await provider.summarizeChunk({ chunk: sampleChunk });
      expect.unreachable();
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(AIProviderError);
      const providerErr = err as AIProviderError;
      expect(providerErr.statusCode).toBe(500);
      expect(providerErr.isRetryable).toBe(true);
    }
  });

  it('throws AIResponseValidationError when model returns malformed or invalid schema output', async () => {
    const invalidResponse = {
      choices: [
        {
          message: {
            content: '{"not_a_summary": 123}', // Missing required fields
          },
        },
      ],
    };

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(invalidResponse), { status: 200 })
    );

    const provider = new NVIDIAProvider({
      apiKey: 'nvapi-key',
      customFetch: mockFetch as unknown as typeof fetch,
    });

    await expect(
      provider.summarizeChunk({ chunk: sampleChunk })
    ).rejects.toThrow(AIResponseValidationError);
  });
});
