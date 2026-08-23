import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/documents/summarize/route';
import { summarizeDocumentFile } from '@/lib/application/document-summarizer';
import { mapErrorToHttpResponse } from '@/lib/application/error-mapper';
import {
  FileTooLargeError,
  AIAuthenticationError,
  AIRateLimitError,
  AIProviderError,
  AIResponseValidationError,
} from '@/types/errors';
import type { AIProvider, DocumentSummary } from '@/types/ai';
import { createValidPdf, createBlankPdf, createCorruptPdf } from './helpers/pdf-fixtures';
import { MAX_FILE_SIZE_BYTES } from '@/lib/validation/file-validation';

function createMockAIProvider(overrides?: Partial<AIProvider>): AIProvider {
  return {
    name: 'nvidia',
    modelName: 'meta/llama-3.3-70b-instruct',
    summarizeChunk: vi.fn().mockResolvedValue({
      chunkId: 'chunk-0',
      startPage: 1,
      endPage: 1,
      pageNumbers: [1],
      summary: 'Chunk summary of quarterly performance and growth.',
      keyPoints: ['Revenue reached $4.2B', '18% YoY growth'],
    }),
    synthesizeSummary: vi.fn().mockImplementation(async (req): Promise<DocumentSummary> => {
      return {
        title: 'Executive Financial Summary',
        overview: 'Comprehensive summary of financial performance.',
        keyPoints: ['Revenue beat expectations at $4.2B', 'Solid operational margins'],
        sections: [
          {
            heading: 'Financial Overview',
            content: 'Detailed discussion of quarterly financial highlights.',
            sourcePages: [1],
            keyFindings: ['18% growth recorded'],
          },
        ],
        sourceReferences: [
          {
            pageNumber: 1,
            chunkId: 'chunk-0',
            relevance: 'Source for quarterly financial highlights',
          },
        ],
        metadata: {
          pageCount: 1,
          totalChunks: 1,
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

describe('POST /api/documents/summarize & Application Service', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AI_PROVIDER;
    delete process.env.NVIDIA_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Route Request Validation', () => {
    it('returns HTTP 400 when request is not multipart/form-data', async () => {
      const req = new NextRequest('http://localhost:3000/api/documents/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ file: 'none' }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FILE_EMPTY');
      expect(json.error.message).toContain('multipart/form-data');
    });

    it('returns HTTP 400 when "file" field is missing in form-data', async () => {
      const formData = new FormData();
      formData.append('unrelatedField', 'test');

      const req = new NextRequest('http://localhost:3000/api/documents/summarize', {
        method: 'POST',
        body: formData,
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FILE_EMPTY');
      expect(json.error.message).toContain('Missing "file" field');
    });

    it('returns HTTP 400 for invalid file type (non-PDF)', async () => {
      const textBlob = new Blob(['Plain text document content'], { type: 'text/plain' });
      const file = new File([textBlob], 'document.txt', { type: 'text/plain' });

      const formData = new FormData();
      formData.append('file', file);

      const req = new NextRequest('http://localhost:3000/api/documents/summarize', {
        method: 'POST',
        body: formData,
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INVALID_FILE_TYPE');
      expect(json.error.message).toContain('Only PDF');
    });

    it('returns HTTP 400 for empty file (0 bytes)', async () => {
      const emptyBlob = new Blob([], { type: 'application/pdf' });
      const file = new File([emptyBlob], 'empty.pdf', { type: 'application/pdf' });

      const formData = new FormData();
      formData.append('file', file);

      const req = new NextRequest('http://localhost:3000/api/documents/summarize', {
        method: 'POST',
        body: formData,
      });

      const res = await POST(req);
      expect(res.status).toBe(400);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FILE_EMPTY');
    });

    it('returns HTTP 413 when uploaded file exceeds 20MB limit', async () => {
      const oversizedFile = new File([createValidPdf().buffer as ArrayBuffer], 'huge.pdf', { type: 'application/pdf' });
      Object.defineProperty(oversizedFile, 'size', { value: MAX_FILE_SIZE_BYTES + 1024 });

      await expect(
        summarizeDocumentFile(oversizedFile)
      ).rejects.toThrow(FileTooLargeError);

      const mapped = mapErrorToHttpResponse(
        new FileTooLargeError('File size exceeds 20MB limit')
      );
      expect(mapped.status).toBe(413);
      expect(mapped.body.error.code).toBe('FILE_TOO_LARGE');
    });
  });

  describe('Document Extraction & Processing Errors', () => {
    it('returns HTTP 422 for corrupt PDF file missing %PDF header', async () => {
      const corruptData = createCorruptPdf();
      const corruptFile = new File([corruptData.buffer as ArrayBuffer], 'corrupt.pdf', { type: 'application/pdf' });

      const formData = new FormData();
      formData.append('file', corruptFile);

      const req = new NextRequest('http://localhost:3000/api/documents/summarize', {
        method: 'POST',
        body: formData,
      });

      const res = await POST(req);
      expect(res.status).toBe(422);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('CORRUPT_DOCUMENT');
    });

    it('returns HTTP 422 when document extraction produces unreadable or empty content', async () => {
      const blankData = createBlankPdf();
      const blankFile = new File([blankData.buffer as ArrayBuffer], 'blank.pdf', { type: 'application/pdf' });

      const formData = new FormData();
      formData.append('file', blankFile);

      const req = new NextRequest('http://localhost:3000/api/documents/summarize', {
        method: 'POST',
        body: formData,
      });

      const res = await POST(req);
      expect(res.status).toBe(422);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(['EMPTY_EXTRACTION', 'OCR_FAILED']).toContain(json.error.code);
    });
  });

  describe('AI Provider & Configuration Errors', () => {
    it('returns HTTP 503 when AI provider is not configured in environment', async () => {
      const pdfBytes = createValidPdf('Test content for unconfigured AI provider.');
      const file = new File([pdfBytes.buffer as ArrayBuffer], 'test.pdf', { type: 'application/pdf' });

      const formData = new FormData();
      formData.append('file', file);

      const req = new NextRequest('http://localhost:3000/api/documents/summarize', {
        method: 'POST',
        body: formData,
      });

      const res = await POST(req);
      expect(res.status).toBe(503);

      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('AI_SERVICE_UNCONFIGURED');
    });

    it('returns HTTP 503 when AI authentication fails without leaking credentials', async () => {
      const pdfBytes = createValidPdf('Authentication failure test content.');
      const file = new File([pdfBytes.buffer as ArrayBuffer], 'test.pdf', { type: 'application/pdf' });

      const failingProvider = createMockAIProvider({
        summarizeChunk: vi.fn().mockRejectedValue(
          new AIAuthenticationError('Invalid secret key xyz123', 'nvidia')
        ),
      });

      await expect(
        summarizeDocumentFile(file, { provider: failingProvider })
      ).rejects.toThrow(AIAuthenticationError);
    });

    it('returns HTTP 429 when AI rate limit is exceeded', async () => {
      const pdfBytes = createValidPdf('Rate limit test content.');
      const file = new File([pdfBytes.buffer as ArrayBuffer], 'test.pdf', { type: 'application/pdf' });

      const rateLimitedProvider = createMockAIProvider({
        summarizeChunk: vi.fn().mockRejectedValue(
          new AIRateLimitError('Rate limit exceeded', 'nvidia', { retryAfterSeconds: 30 })
        ),
      });

      await expect(
        summarizeDocumentFile(file, {
          provider: rateLimitedProvider,
          aiOptions: { maxRetries: 0 },
        })
      ).rejects.toThrow(AIRateLimitError);
    });

    it('returns HTTP 502 when AI response fails schema validation', async () => {
      const mapped = mapErrorToHttpResponse(
        new AIResponseValidationError('Model returned invalid response', {
          provider: 'nvidia',
          snippet: '{"bad": 1}',
        })
      );
      expect(mapped.status).toBe(502);
      expect(mapped.body.error.code).toBe('AI_INVALID_RESPONSE');
    });
  });

  describe('End-to-End Successful Flow with Mocked AI Provider', () => {
    it('successfully extracts, processes, and summarizes a valid PDF', async () => {
      const pdfBytes = createValidPdf(
        'Quarterly earnings report demonstrating remarkable operational resilience and 18% revenue expansion.'
      );
      const file = new File([pdfBytes.buffer as ArrayBuffer], 'quarterly_report.pdf', { type: 'application/pdf' });

      const mockProvider = createMockAIProvider();

      const result = await summarizeDocumentFile(file, {
        provider: mockProvider,
        extractionOptions: { ocrThreshold: 10 },
      });

      expect(result.success).toBe(true);

      // Verify summary structure
      expect(result.summary.title).toBe('Executive Financial Summary');
      expect(result.summary.overview).toContain('Comprehensive summary');
      expect(result.summary.keyPoints).toHaveLength(2);
      expect(result.summary.sections).toHaveLength(1);
      expect(result.summary.sourceReferences).toHaveLength(1);

      // Verify extraction metadata
      expect(result.extraction.method).toBe('native');
      expect(result.extraction.pageCount).toBe(1);
      expect(result.extraction.fileName).toBe('quarterly_report.pdf');
      expect(result.extraction.totalCharCount).toBeGreaterThan(0);

      // Verify processing metadata
      expect(result.processing.totalChunks).toBe(1);
      expect(result.processing.totalApproximateTokens).toBeGreaterThan(0);
      expect(result.processing.totalCharCount).toBeGreaterThan(0);

      // Verify mock calls
      expect(mockProvider.summarizeChunk).toHaveBeenCalledTimes(1);
      expect(mockProvider.synthesizeSummary).toHaveBeenCalledTimes(1);
    });

    it('guarantees safe error responses with no sensitive leaks', async () => {
      const pdfBytes = createValidPdf('Secret verification test.');
      const file = new File([pdfBytes.buffer as ArrayBuffer], 'test.pdf', { type: 'application/pdf' });

      const providerWithSecrets = createMockAIProvider({
        summarizeChunk: vi.fn().mockRejectedValue(
          new AIProviderError('Failed at internal endpoint with secret key sk-test-999', 'nvidia', {
            statusCode: 500,
          })
        ),
      });

      try {
        await summarizeDocumentFile(file, {
          provider: providerWithSecrets,
          aiOptions: { maxRetries: 0 },
        });
        expect.unreachable();
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(AIProviderError);
      }
    });

    it('sanitizes internal file paths and secrets from extraction error responses', async () => {
      const { DocumentExtractionError } = await import('@/types/errors');
      const mapped = mapErrorToHttpResponse(
        new DocumentExtractionError(
          'Failed to parse PDF: corrupt table at /var/www/internal/app/document.pdf with token key=secret123',
          'EXTRACTION_FAILED'
        )
      );

      expect(mapped.status).toBe(422);
      expect(mapped.body.error.code).toBe('EXTRACTION_FAILED');
      expect(mapped.body.error.message).not.toContain('/var/www/internal/app');
      expect(mapped.body.error.message).not.toContain('secret123');
      expect(mapped.body.error.message).toContain('[path]');
      expect(mapped.body.error.message).toContain('[redacted]');
    });
  });
});
