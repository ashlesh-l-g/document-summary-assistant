import {
  DocumentExtractionError,
  InvalidFileTypeError,
  FileTooLargeError,
  EmptyFileError,
  CorruptDocumentError,
  EmptyExtractionError,
  OcrProcessingError,
  PasswordProtectedDocumentError,
  DocumentProcessingError,
  InvalidProcessingConfigError,
  EmptyDocumentProcessingError,
  ChunkingError,
  AIError,
  AIConfigurationError,
  AIAuthenticationError,
  AIRateLimitError,
  AIProviderError,
  AIResponseValidationError,
  AISummarizationError,
} from '@/types/errors';
import type { ApiErrorResponse } from '@/types/api';

export interface HttpErrorResult {
  readonly status: number;
  readonly body: ApiErrorResponse;
}

/**
 * Maps domain and infrastructure errors to standard HTTP status codes and safe client error payloads.
 *
 * Guarantees:
 * - No API keys or credentials leaked
 * - No internal filesystem paths leaked
 * - No stack traces exposed to client
 * - No raw customer document content dumped
 */
export function mapErrorToHttpResponse(error: unknown): HttpErrorResult {
  // 1. File & Metadata Validation Errors
  if (error instanceof InvalidFileTypeError) {
    return {
      status: 400,
      body: {
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: error.message || 'Invalid file type. Only PDF documents are supported.',
        },
      },
    };
  }

  if (error instanceof EmptyFileError) {
    return {
      status: 400,
      body: {
        success: false,
        error: {
          code: 'FILE_EMPTY',
          message: error.message || 'Uploaded file is empty (0 bytes).',
        },
      },
    };
  }

  if (error instanceof FileTooLargeError) {
    return {
      status: 413,
      body: {
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: error.message || 'The uploaded file exceeds the 20MB maximum size limit.',
        },
      },
    };
  }

  // 2. Document Extraction & Corruption Errors
  if (error instanceof PasswordProtectedDocumentError) {
    return {
      status: 422,
      body: {
        success: false,
        error: {
          code: 'PASSWORD_PROTECTED',
          message: 'The PDF document is password-protected and cannot be processed.',
        },
      },
    };
  }

  if (error instanceof CorruptDocumentError) {
    return {
      status: 422,
      body: {
        success: false,
        error: {
          code: 'CORRUPT_DOCUMENT',
          message: 'The PDF document is corrupt, malformed, or has an invalid header.',
        },
      },
    };
  }

  if (error instanceof EmptyExtractionError) {
    return {
      status: 422,
      body: {
        success: false,
        error: {
          code: 'EMPTY_EXTRACTION',
          message:
            'No readable text could be extracted from the document. The document may be blank or unreadable.',
        },
      },
    };
  }

  if (error instanceof OcrProcessingError) {
    return {
      status: 422,
      body: {
        success: false,
        error: {
          code: 'OCR_FAILED',
          message: 'OCR text recognition failed on one or more scanned pages.',
        },
      },
    };
  }

  if (error instanceof DocumentExtractionError) {
    return {
      status: 422,
      body: {
        success: false,
        error: {
          code: error.code || 'EXTRACTION_FAILED',
          message: 'Failed to extract text from the uploaded document.',
        },
      },
    };
  }

  // 3. Processing & Chunking Errors
  if (error instanceof EmptyDocumentProcessingError) {
    return {
      status: 422,
      body: {
        success: false,
        error: {
          code: 'EMPTY_DOCUMENT',
          message: 'The document does not contain sufficient text for summarization.',
        },
      },
    };
  }

  if (error instanceof InvalidProcessingConfigError) {
    return {
      status: 400,
      body: {
        success: false,
        error: {
          code: 'INVALID_PROCESSING_CONFIG',
          message: 'Invalid chunking or processing parameters.',
        },
      },
    };
  }

  if (error instanceof ChunkingError || error instanceof DocumentProcessingError) {
    return {
      status: 422,
      body: {
        success: false,
        error: {
          code: 'PROCESSING_FAILED',
          message: 'Failed to process and chunk document text.',
        },
      },
    };
  }

  // 4. AI Provider & Configuration Errors
  if (error instanceof AIConfigurationError) {
    return {
      status: 503,
      body: {
        success: false,
        error: {
          code: 'AI_SERVICE_UNCONFIGURED',
          message:
            'AI summarization service is currently unconfigured or missing provider credentials.',
        },
      },
    };
  }

  if (error instanceof AIAuthenticationError) {
    return {
      status: 503,
      body: {
        success: false,
        error: {
          code: 'AI_AUTHENTICATION_FAILED',
          message:
            'AI summarization service authentication failed. Please check server API key configuration.',
        },
      },
    };
  }

  if (error instanceof AIRateLimitError) {
    return {
      status: 429,
      body: {
        success: false,
        error: {
          code: 'AI_RATE_LIMIT_EXCEEDED',
          message: 'AI provider rate limit reached. Please try again in a few moments.',
          details: error.retryAfterSeconds
            ? { retryAfterSeconds: error.retryAfterSeconds }
            : undefined,
        },
      },
    };
  }

  if (error instanceof AIResponseValidationError) {
    return {
      status: 502,
      body: {
        success: false,
        error: {
          code: 'AI_INVALID_RESPONSE',
          message:
            'AI provider returned a response that did not match the expected summary schema. Please retry.',
        },
      },
    };
  }

  if (error instanceof AIProviderError) {
    return {
      status: error.isRetryable ? 503 : 500,
      body: {
        success: false,
        error: {
          code: 'AI_PROVIDER_ERROR',
          message: 'The AI summarization service encountered an error processing the request.',
        },
      },
    };
  }

  if (error instanceof AISummarizationError) {
    return {
      status: 500,
      body: {
        success: false,
        error: {
          code: 'SUMMARIZATION_FAILED',
          message: 'Failed to complete document summarization.',
        },
      },
    };
  }

  if (error instanceof AIError) {
    return {
      status: 500,
      body: {
        success: false,
        error: {
          code: error.code || 'AI_ERROR',
          message: 'An error occurred during AI summarization.',
        },
      },
    };
  }

  // 5. Fallback for unexpected internal errors
  return {
    status: 500,
    body: {
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected internal error occurred while processing the document.',
      },
    },
  };
}
