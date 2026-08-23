import { z } from 'zod';
import {
  EmptyFileError,
  FileTooLargeError,
  InvalidFileTypeError,
  CorruptDocumentError,
} from '@/types/errors';
import type { FileInputMetadata } from '@/types/document';

/**
 * Maximum supported PDF file size: 20 MB
 */
export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

/**
 * Minimum valid PDF file size: 32 bytes (minimum valid PDF header/trailer)
 */
export const MIN_FILE_SIZE_BYTES = 32;

/**
 * Supported MIME types for document ingestion
 */
export const ACCEPTED_PDF_MIME_TYPES = [
  'application/pdf',
  'application/x-pdf',
  'application/acrobat',
  'applications/vnd.pdf',
  'text/pdf',
  'text/x-pdf',
] as const;

export const ACCEPTED_IMAGE_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
] as const;

/**
 * Standard PDF Magic Bytes: "%PDF" (0x25, 0x50, 0x44, 0x46)
 */
export const PDF_MAGIC_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46]);

/**
 * Zod schema for file input metadata
 */
export const fileMetadataSchema = z.object({
  name: z.string().min(1, 'File name is required'),
  size: z
    .number()
    .int()
    .positive('File must not be empty')
    .max(MAX_FILE_SIZE_BYTES, `File size exceeds the 20MB limit`),
  type: z.string().optional(),
});

/**
 * Check if the filename ends with .pdf (case-insensitive)
 */
export function hasPdfExtension(fileName: string): boolean {
  return typeof fileName === 'string' && /\.pdf$/i.test(fileName.trim());
}

/**
 * Check if the MIME type is a recognized PDF MIME type
 */
export function isPdfMimeType(mimeType?: string): boolean {
  if (!mimeType) return false;
  const normalized = mimeType.trim().toLowerCase();
  return ACCEPTED_PDF_MIME_TYPES.some((t) => t === normalized);
}

/**
 * Verify whether binary buffer begins with "%PDF" magic bytes
 */
export function hasPdfMagicBytes(buffer: ArrayBuffer | Uint8Array): boolean {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.byteLength < PDF_MAGIC_BYTES.length) {
    return false;
  }
  for (let i = 0; i < PDF_MAGIC_BYTES.length; i++) {
    if (bytes[i] !== PDF_MAGIC_BYTES[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Check if the filename ends with an accepted image extension (.png, .jpg, .jpeg, .webp)
 */
export function hasImageExtension(fileName: string): boolean {
  return typeof fileName === 'string' && /\.(png|jpe?g|webp)$/i.test(fileName.trim());
}

/**
 * Check if the MIME type is a recognized image MIME type
 */
export function isImageMimeType(mimeType?: string): boolean {
  if (!mimeType) return false;
  const normalized = mimeType.trim().toLowerCase();
  return ACCEPTED_IMAGE_MIME_TYPES.some((t) => t === normalized);
}

/**
 * Validate metadata for an uploaded image file
 */
export function validateImageMetadata(metadata: {
  name: string;
  size: number;
  type?: string;
}): FileInputMetadata {
  if (metadata.size <= 0) {
    throw new EmptyFileError('Uploaded image file is empty (0 bytes).', {
      fileName: metadata.name,
      fileSize: metadata.size,
    });
  }

  if (metadata.size > MAX_FILE_SIZE_BYTES) {
    throw new FileTooLargeError(
      `Image file size (${(metadata.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of 20MB.`,
      {
        fileName: metadata.name,
        fileSize: metadata.size,
        maxSize: MAX_FILE_SIZE_BYTES,
      }
    );
  }

  const isImgExt = hasImageExtension(metadata.name);
  const isImgMime = isImageMimeType(metadata.type);

  if (!isImgExt && !isImgMime) {
    throw new InvalidFileTypeError(
      `Invalid file "${metadata.name}". Only images (PNG, JPG, JPEG, WEBP) are supported.`,
      {
        fileName: metadata.name,
        fileType: metadata.type,
      }
    );
  }

  return {
    name: metadata.name,
    size: metadata.size,
    type: metadata.type || 'image/png',
  };
}

/**
 * Validate metadata for an uploaded file
 */
export function validateFileMetadata(metadata: {
  name: string;
  size: number;
  type?: string;
}): FileInputMetadata {
  if (metadata.size <= 0) {
    throw new EmptyFileError('Uploaded file is empty (0 bytes).', {
      fileName: metadata.name,
      fileSize: metadata.size,
    });
  }

  if (metadata.size > MAX_FILE_SIZE_BYTES) {
    throw new FileTooLargeError(
      `File size (${(metadata.size / (1024 * 1024)).toFixed(1)}MB) exceeds maximum limit of 20MB.`,
      {
        fileName: metadata.name,
        fileSize: metadata.size,
        maxSize: MAX_FILE_SIZE_BYTES,
      }
    );
  }

  const isPdfExt = hasPdfExtension(metadata.name);
  const isPdfMime = isPdfMimeType(metadata.type);

  // If MIME is provided but not PDF and extension is also not PDF, reject
  if (!isPdfExt && !isPdfMime) {
    throw new InvalidFileTypeError(
      `Invalid file "${metadata.name}". Only PDF files (.pdf) are supported.`,
      {
        fileName: metadata.name,
        fileType: metadata.type,
      }
    );
  }

  return {
    name: metadata.name,
    size: metadata.size,
    type: metadata.type || 'application/pdf',
  };
}

/**
 * Validate raw PDF binary buffer
 */
export function validatePdfBuffer(
  buffer: ArrayBuffer | Uint8Array,
  fileName?: string
): Uint8Array {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  if (bytes.byteLength === 0) {
    throw new EmptyFileError('PDF buffer is empty (0 bytes).', {
      fileName,
      size: 0,
    });
  }

  if (bytes.byteLength > MAX_FILE_SIZE_BYTES) {
    throw new FileTooLargeError(
      `PDF buffer exceeds maximum limit of 20MB (${bytes.byteLength} bytes).`,
      {
        fileName,
        size: bytes.byteLength,
        maxSize: MAX_FILE_SIZE_BYTES,
      }
    );
  }

  if (bytes.byteLength < MIN_FILE_SIZE_BYTES || !hasPdfMagicBytes(bytes)) {
    throw new CorruptDocumentError(
      `File does not have a valid PDF header (%PDF).`,
      {
        fileName,
        size: bytes.byteLength,
      }
    );
  }

  return bytes;
}
