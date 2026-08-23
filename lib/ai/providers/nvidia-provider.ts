import type {
  AIProvider,
  AIProviderName,
  ChunkSummary,
  DocumentSummary,
  ChunkSummaryRequest,
  DocumentSynthesisRequest,
  AIProviderConfig,
} from '@/types/ai';
import {
  AIAuthenticationError,
  AIConfigurationError,
  AIProviderError,
  AIRateLimitError,
} from '@/types/errors';
import {
  parseAndValidateChunkSummary,
  parseAndValidateDocumentSummary,
} from '@/lib/validation/ai-validation';
import {
  buildChunkSummaryPrompt,
  buildDocumentSynthesisPrompt,
} from '@/lib/ai/prompts';

export const DEFAULT_NVIDIA_MODEL = 'meta/llama-3.3-70b-instruct';
export const DEFAULT_NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

export interface NVIDIAProviderOptions extends Partial<AIProviderConfig> {
  readonly customFetch?: typeof fetch;
}

export class NVIDIAProvider implements AIProvider {
  readonly name: AIProviderName = 'nvidia';
  readonly modelName: string;
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly fetchFn: typeof fetch;

  constructor(options?: NVIDIAProviderOptions) {
    const apiKey = options?.apiKey || process.env.NVIDIA_API_KEY;

    if (!apiKey || apiKey.trim().length === 0) {
      throw new AIConfigurationError(
        'NVIDIA API key is missing. Set NVIDIA_API_KEY environment variable or pass apiKey in config.'
      );
    }

    this.apiKey = apiKey.trim();
    this.modelName = options?.model || process.env.NVIDIA_MODEL || DEFAULT_NVIDIA_MODEL;
    this.baseURL = (options?.baseURL || process.env.NVIDIA_BASE_URL || DEFAULT_NVIDIA_BASE_URL).replace(/\/+$/, '');
    this.fetchFn = options?.customFetch || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : fetch);
  }

  private async callChatCompletion(
    systemPrompt: string,
    userPrompt: string,
    options?: { temperature?: number; maxOutputTokens?: number; signal?: AbortSignal }
  ): Promise<string> {
    const endpoint = `${this.baseURL}/chat/completions`;

    const requestBody = {
      model: this.modelName,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: options?.temperature ?? 0.2,
      max_tokens: options?.maxOutputTokens ?? 4096,
      response_format: { type: 'json_object' },
    };

    let response: Response;

    try {
      response = await this.fetchFn(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: options?.signal,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }
      throw new AIProviderError(
        'NVIDIA API network connection failed.',
        this.name,
        {
          isRetryable: true,
          details: { message: err instanceof Error ? err.message : 'Network error' },
          cause: err,
        }
      );
    }

    if (!response.ok) {
      const statusCode = response.status;
      let errorBody = '';
      try {
        errorBody = await response.text();
      } catch {
        // Non-fatal
      }

      if (statusCode === 401 || statusCode === 403) {
        throw new AIAuthenticationError(
          'NVIDIA API authentication failed. Verify that your NVIDIA_API_KEY is valid.',
          this.name,
          { details: { statusCode } }
        );
      }

      if (statusCode === 429) {
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
        throw new AIRateLimitError(
          'NVIDIA API rate limit exceeded.',
          this.name,
          {
            retryAfterSeconds: isNaN(retryAfterSeconds ?? NaN) ? undefined : retryAfterSeconds,
            details: { statusCode },
          }
        );
      }

      const isRetryable = statusCode >= 500 || statusCode === 408;
      throw new AIProviderError(
        `NVIDIA API request failed with status ${statusCode}.`,
        this.name,
        {
          statusCode,
          isRetryable,
          details: { errorSnippet: errorBody.slice(0, 300) },
        }
      );
    }

    let payload: { choices?: Array<{ message?: { content?: string } }> };

    try {
      payload = await response.json();
    } catch (err) {
      throw new AIProviderError(
        'NVIDIA API returned invalid JSON in HTTP response.',
        this.name,
        { isRetryable: true, cause: err }
      );
    }

    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new AIProviderError(
        'NVIDIA API returned empty choices or message content.',
        this.name,
        { isRetryable: false }
      );
    }

    return content;
  }

  async summarizeChunk(request: ChunkSummaryRequest): Promise<ChunkSummary> {
    const { systemPrompt, userPrompt } = buildChunkSummaryPrompt(request);
    const rawContent = await this.callChatCompletion(
      systemPrompt,
      userPrompt,
      request.options
    );

    return parseAndValidateChunkSummary(rawContent, request, this.name);
  }

  async synthesizeSummary(request: DocumentSynthesisRequest): Promise<DocumentSummary> {
    const { systemPrompt, userPrompt } = buildDocumentSynthesisPrompt(request);
    const rawContent = await this.callChatCompletion(
      systemPrompt,
      userPrompt,
      request.options
    );

    return parseAndValidateDocumentSummary(rawContent, request, {
      provider: this.name,
      model: this.modelName,
    });
  }
}
