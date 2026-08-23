import { z } from 'zod';
import { InvalidProcessingConfigError } from '@/types/errors';
import type { ProcessingOptions } from '@/types/processing';

export const DEFAULT_TARGET_CHUNK_SIZE = 1500;
export const DEFAULT_MAX_CHUNK_SIZE = 2500;
export const DEFAULT_MIN_CHUNK_SIZE = 200;
export const DEFAULT_OVERLAP = 200;

export const processingOptionsSchema = z
  .object({
    targetChunkSize: z
      .number()
      .int()
      .min(50, 'targetChunkSize must be at least 50 characters')
      .default(DEFAULT_TARGET_CHUNK_SIZE),
    maxChunkSize: z
      .number()
      .int()
      .min(50, 'maxChunkSize must be at least 50 characters')
      .default(DEFAULT_MAX_CHUNK_SIZE),
    minChunkSize: z
      .number()
      .int()
      .min(10, 'minChunkSize must be at least 10 characters')
      .default(DEFAULT_MIN_CHUNK_SIZE),
    overlap: z
      .number()
      .int()
      .min(0, 'overlap cannot be negative')
      .default(DEFAULT_OVERLAP),
  })
  .refine((data) => data.maxChunkSize >= data.targetChunkSize, {
    message: 'maxChunkSize must be greater than or equal to targetChunkSize',
    path: ['maxChunkSize'],
  })
  .refine((data) => data.targetChunkSize >= data.minChunkSize, {
    message: 'targetChunkSize must be greater than or equal to minChunkSize',
    path: ['targetChunkSize'],
  })
  .refine((data) => data.overlap < data.targetChunkSize, {
    message: 'overlap must be strictly less than targetChunkSize',
    path: ['overlap'],
  });

/**
 * Validate and resolve processing options with strict constraints and defaults
 */
export function validateProcessingOptions(
  options?: ProcessingOptions
): Required<ProcessingOptions> {
  const target = options?.targetChunkSize ?? DEFAULT_TARGET_CHUNK_SIZE;
  const defaultMin = Math.min(DEFAULT_MIN_CHUNK_SIZE, Math.max(10, Math.floor(target * 0.15)));
  const defaultOverlap = Math.min(DEFAULT_OVERLAP, Math.max(0, Math.floor(target * 0.15)));

  const resolvedInput = {
    targetChunkSize: target,
    maxChunkSize: options?.maxChunkSize ?? (target > DEFAULT_MAX_CHUNK_SIZE ? target : DEFAULT_MAX_CHUNK_SIZE),
    minChunkSize: options?.minChunkSize ?? defaultMin,
    overlap: options?.overlap ?? defaultOverlap,
  };

  const result = processingOptionsSchema.safeParse(resolvedInput);

  if (!result.success) {
    const errorDetails = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    throw new InvalidProcessingConfigError(
      `Invalid chunking options: ${errorDetails}`,
      { validationErrors: result.error.issues }
    );
  }

  return result.data as Required<ProcessingOptions>;
}
