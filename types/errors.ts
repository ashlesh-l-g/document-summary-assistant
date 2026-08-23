/**
 * Document Summary Assistant - Error Hierarchy
 */

export type ExtractionErrorCode =
  | 'INVALID_FILE_TYPE'
  | 'FILE_TOO_LARGE'
  | 'FILE_EMPTY'
  | 'CORRUPT_DOCUMENT'
  | 'EMPTY_EXTRACTION'
  | 'EXTRACTION_FAILED'
  | 'OCR_FAILED'
  | 'PASSWORD_PROTECTED'
  | 'UNSUPPORTED_OPERATION';

export interface ExtractionErrorDetails {
  readonly [key: string]: unknown;
}

export class DocumentExtractionError extends Error {
  readonly code: ExtractionErrorCode;
  readonly details?: ExtractionErrorDetails;
  override readonly cause?: unknown;

  constructor(
    message: string,
    code: ExtractionErrorCode,
    details?: ExtractionErrorDetails,
    cause?: unknown
  ) {
    super(message);
    this.name = 'DocumentExtractionError';
    this.code = code;
    this.details = details;
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidFileTypeError extends DocumentExtractionError {
  constructor(
    message = 'Invalid file type. Only PDF documents are supported.',
    details?: ExtractionErrorDetails
  ) {
    super(message, 'INVALID_FILE_TYPE', details);
    this.name = 'InvalidFileTypeError';
  }
}

export class FileTooLargeError extends DocumentExtractionError {
  constructor(
    message = 'File size exceeds maximum allowed limit.',
    details?: ExtractionErrorDetails
  ) {
    super(message, 'FILE_TOO_LARGE', details);
    this.name = 'FileTooLargeError';
  }
}

export class EmptyFileError extends DocumentExtractionError {
  constructor(
    message = 'The uploaded file is empty.',
    details?: ExtractionErrorDetails
  ) {
    super(message, 'FILE_EMPTY', details);
    this.name = 'EmptyFileError';
  }
}

export class CorruptDocumentError extends DocumentExtractionError {
  constructor(
    message = 'The PDF document is corrupt, malformed, or cannot be read.',
    details?: ExtractionErrorDetails,
    cause?: unknown
  ) {
    super(message, 'CORRUPT_DOCUMENT', details, cause);
    this.name = 'CorruptDocumentError';
  }
}

export class EmptyExtractionError extends DocumentExtractionError {
  constructor(
    message = 'No readable text could be extracted from the document.',
    details?: ExtractionErrorDetails
  ) {
    super(message, 'EMPTY_EXTRACTION', details);
    this.name = 'EmptyExtractionError';
  }
}

export class OcrProcessingError extends DocumentExtractionError {
  constructor(
    message = 'OCR processing failed for one or more pages.',
    details?: ExtractionErrorDetails,
    cause?: unknown
  ) {
    super(message, 'OCR_FAILED', details, cause);
    this.name = 'OcrProcessingError';
  }
}

export class PasswordProtectedDocumentError extends DocumentExtractionError {
  constructor(
    message = 'The PDF document is password-protected and cannot be extracted.',
    details?: ExtractionErrorDetails
  ) {
    super(message, 'PASSWORD_PROTECTED', details);
    this.name = 'PasswordProtectedDocumentError';
  }
}

/**
 * Processing & Chunking Error Types
 */

export type ProcessingErrorCode =
  | 'INVALID_PROCESSING_CONFIG'
  | 'EMPTY_PROCESSED_DOCUMENT'
  | 'PROCESSING_FAILED'
  | 'CHUNKING_FAILED';

export class DocumentProcessingError extends Error {
  readonly code: ProcessingErrorCode;
  readonly details?: ExtractionErrorDetails;
  override readonly cause?: unknown;

  constructor(
    message: string,
    code: ProcessingErrorCode,
    details?: ExtractionErrorDetails,
    cause?: unknown
  ) {
    super(message);
    this.name = 'DocumentProcessingError';
    this.code = code;
    this.details = details;
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidProcessingConfigError extends DocumentProcessingError {
  constructor(
    message = 'Invalid document processing configuration.',
    details?: ExtractionErrorDetails
  ) {
    super(message, 'INVALID_PROCESSING_CONFIG', details);
    this.name = 'InvalidProcessingConfigError';
  }
}

export class EmptyDocumentProcessingError extends DocumentProcessingError {
  constructor(
    message = 'Cannot process an empty document with no text content.',
    details?: ExtractionErrorDetails
  ) {
    super(message, 'EMPTY_PROCESSED_DOCUMENT', details);
    this.name = 'EmptyDocumentProcessingError';
  }
}

export class ChunkingError extends DocumentProcessingError {
  constructor(
    message = 'Failed to split document into valid chunks.',
    details?: ExtractionErrorDetails,
    cause?: unknown
  ) {
    super(message, 'CHUNKING_FAILED', details, cause);
    this.name = 'ChunkingError';
  }
}

/**
 * AI Provider & Summarization Error Types
 */

export type AIErrorCode =
  | 'AI_CONFIGURATION_ERROR'
  | 'AI_PROVIDER_ERROR'
  | 'AI_RATE_LIMIT_ERROR'
  | 'AI_AUTHENTICATION_ERROR'
  | 'AI_RESPONSE_VALIDATION_ERROR'
  | 'AI_SUMMARIZATION_ERROR'
  | 'AI_TIMEOUT_ERROR';

export class AIError extends Error {
  readonly code: AIErrorCode;
  readonly details?: ExtractionErrorDetails;
  override readonly cause?: unknown;

  constructor(
    message: string,
    code: AIErrorCode,
    details?: ExtractionErrorDetails,
    cause?: unknown
  ) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    this.details = details;
    this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AIConfigurationError extends AIError {
  constructor(
    message: string,
    details?: ExtractionErrorDetails
  ) {
    super(message, 'AI_CONFIGURATION_ERROR', details);
    this.name = 'AIConfigurationError';
  }
}

export class AIProviderError extends AIError {
  readonly provider: string;
  readonly statusCode?: number;
  readonly isRetryable: boolean;

  constructor(
    message: string,
    provider: string,
    options?: {
      statusCode?: number;
      isRetryable?: boolean;
      details?: ExtractionErrorDetails;
      cause?: unknown;
    }
  ) {
    super(message, 'AI_PROVIDER_ERROR', options?.details, options?.cause);
    this.name = 'AIProviderError';
    this.provider = provider;
    this.statusCode = options?.statusCode;
    this.isRetryable = options?.isRetryable ?? false;
  }
}

export class AIRateLimitError extends AIError {
  readonly provider: string;
  readonly retryAfterSeconds?: number;

  constructor(
    message: string,
    provider: string,
    options?: {
      retryAfterSeconds?: number;
      details?: ExtractionErrorDetails;
      cause?: unknown;
    }
  ) {
    super(message, 'AI_RATE_LIMIT_ERROR', options?.details, options?.cause);
    this.name = 'AIRateLimitError';
    this.provider = provider;
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

export class AIAuthenticationError extends AIError {
  readonly provider: string;

  constructor(
    message: string,
    provider: string,
    options?: {
      details?: ExtractionErrorDetails;
      cause?: unknown;
    }
  ) {
    super(message, 'AI_AUTHENTICATION_ERROR', options?.details, options?.cause);
    this.name = 'AIAuthenticationError';
    this.provider = provider;
  }
}

export class AIResponseValidationError extends AIError {
  readonly provider?: string;
  readonly validationErrors?: unknown;

  constructor(
    message: string,
    options?: {
      provider?: string;
      validationErrors?: unknown;
      snippet?: string;
      cause?: unknown;
    }
  ) {
    super(
      message,
      'AI_RESPONSE_VALIDATION_ERROR',
      options ? { snippet: options.snippet, provider: options.provider } : undefined,
      options?.cause
    );
    this.name = 'AIResponseValidationError';
    this.provider = options?.provider;
    this.validationErrors = options?.validationErrors;
  }
}

export class AISummarizationError extends AIError {
  readonly stage?: string;

  constructor(
    message: string,
    options?: {
      stage?: string;
      details?: ExtractionErrorDetails;
      cause?: unknown;
    }
  ) {
    super(message, 'AI_SUMMARIZATION_ERROR', options?.details, options?.cause);
    this.name = 'AISummarizationError';
    this.stage = options?.stage;
  }
}
