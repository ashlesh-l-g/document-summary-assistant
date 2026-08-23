/**
 * Document Summary Assistant - Core Document & Extraction Types
 */

export type ExtractionMethod = 'native' | 'ocr' | 'mixed';

export type PageExtractionMethod = 'native' | 'ocr';

export interface ExtractedPage {
  readonly pageNumber: number;
  readonly text: string;
  readonly method: PageExtractionMethod;
  readonly charCount: number;
  readonly confidence?: number;
  readonly isScanned?: boolean;
}

export interface DocumentMetadata {
  readonly pageCount: number;
  readonly fileName?: string;
  readonly fileSizeBytes?: number;
  readonly mimeType?: string;
  readonly title?: string;
  readonly author?: string;
  readonly creator?: string;
  readonly producer?: string;
  readonly creationDate?: string;
  readonly isScanned?: boolean;
}

export interface ExtractedDocument {
  readonly text: string;
  readonly pages: readonly ExtractedPage[];
  readonly method: ExtractionMethod;
  readonly metadata: DocumentMetadata;
  readonly totalCharCount: number;
  readonly warning?: string;
}

export type ExtractionProgressStage =
  | 'validating'
  | 'loading'
  | 'extracting'
  | 'ocr'
  | 'completed';

export interface ExtractionProgress {
  readonly stage: ExtractionProgressStage;
  readonly currentPage?: number;
  readonly totalPages?: number;
  readonly percent?: number;
  readonly message?: string;
}

export type ProgressCallback = (progress: ExtractionProgress) => void;

export type OcrImageRecognizer = (
  imageSource: ImageData | HTMLCanvasElement | Uint8Array | Buffer | string,
  options?: { language?: string; pageNumber?: number }
) => Promise<{ text: string; confidence?: number }>;

export interface ExtractionOptions {
  /**
   * Minimum characters expected on a page. If fewer characters are extracted natively,
   * OCR fallback will be triggered for that page.
   * Default: 50
   */
  readonly ocrThreshold?: number;

  /**
   * Force OCR on all pages regardless of native text presence.
   * Default: false
   */
  readonly forceOcr?: boolean;

  /**
   * Primary language for OCR processing.
   * Default: 'eng'
   */
  readonly ocrLanguage?: string;

  /**
   * Maximum pages to process (for limits/preview).
   */
  readonly maxPages?: number;

  /**
   * Progress callback.
   */
  readonly onProgress?: ProgressCallback;

  /**
   * Optional custom/injected OCR recognizer (useful for tests or alternate OCR backends).
   */
  readonly customOcrRecognizer?: OcrImageRecognizer;
}

export interface FileInputMetadata {
  readonly name: string;
  readonly size: number;
  readonly type: string;
  readonly lastModified?: number;
}
