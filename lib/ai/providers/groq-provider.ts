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

export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-20b';
export const DEFAULT_GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
export const DEFAULT_GROQ_TIMEOUT_MS = 60_000;

export interface GroqProviderOptions extends Partial<AIProviderConfig> {
  readonly customFetch?: typeof fetch;
  readonly timeoutMs?: number;
}

export class GroqProvider implements AIProvider {
  readonly name: AIProviderName = 'groq';
  readonly modelName: string;
  private readonly apiKey: string;
  private readonly baseURL: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options?: GroqProviderOptions) {
    const apiKey = options?.apiKey || process.env.GROQ_API_KEY;

    if (!apiKey || apiKey.trim().length === 0) {
      throw new AIConfigurationError(
        'Groq API key is missing. Set GROQ_API_KEY environment variable or pass apiKey in config.'
      );
    }

    this.apiKey = apiKey.trim();
    this.modelName = options?.model || process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
    this.baseURL = (options?.baseURL || process.env.GROQ_BASE_URL || DEFAULT_GROQ_BASE_URL).replace(/\/+$/, '');
    this.fetchFn = options?.customFetch || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : fetch);
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_GROQ_TIMEOUT_MS;
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
    };

    const controller = new AbortController();
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, this.timeoutMs);

    let onCallerAbort: (() => void) | undefined;
    if (options?.signal) {
      if (options.signal.aborted) {
        clearTimeout(timeoutId);
        controller.abort();
      } else {
        onCallerAbort = () => {
          controller.abort();
        };
        options.signal.addEventListener('abort', onCallerAbort, { once: true });
      }
    }

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
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if (options?.signal?.aborted) {
        throw new AIProviderError('Groq API request was aborted by client.', this.name, {
          isRetryable: false,
          cause: err,
        });
      }

      if (timedOut) {
        throw new AIProviderError(
          `Groq API request timed out after ${Math.round(this.timeoutMs / 1000)} seconds.`,
          this.name,
          {
            statusCode: 408,
            isRetryable: true,
            cause: err,
          }
        );
      }

      if (err instanceof Error && err.name === 'AbortError') {
        throw err;
      }

      throw new AIProviderError(
        'Groq API network connection failed.',
        this.name,
        {
          isRetryable: true,
          details: { message: err instanceof Error ? err.message : 'Network error' },
          cause: err,
        }
      );
    } finally {
      clearTimeout(timeoutId);
      if (options?.signal && onCallerAbort) {
        options.signal.removeEventListener('abort', onCallerAbort);
      }
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
          'Groq API authentication failed. Verify that your GROQ_API_KEY is valid.',
          this.name,
          { details: { statusCode } }
        );
      }

      if (statusCode === 429) {
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfterSeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;
        throw new AIRateLimitError(
          'Groq API rate limit exceeded.',
          this.name,
          {
            retryAfterSeconds: isNaN(retryAfterSeconds ?? NaN) ? undefined : retryAfterSeconds,
            details: { statusCode },
          }
        );
      }

      const isRetryable = statusCode >= 500 || statusCode === 408;
      throw new AIProviderError(
        `Groq API request failed with status ${statusCode}.`,
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
        'Groq API returned invalid JSON in HTTP response.',
        this.name,
        { isRetryable: true, cause: err }
      );
    }

    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.trim().length === 0) {
      throw new AIProviderError(
        'Groq API returned empty choices or message content.',
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
