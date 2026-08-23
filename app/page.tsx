'use client';

import React, { useState } from 'react';
import { Header } from '@/components/header';
import { UploadZone } from '@/components/upload-zone';
import { SummaryConfig, type SummaryLength } from '@/components/summary-config';
import { ProcessingState, type ProcessingStep } from '@/components/processing-state';
import { SummaryResult } from '@/components/summary-result';
import { ErrorAlert } from '@/components/error-alert';
import { extractDocument } from '@/lib/extraction/document-extractor';
import { extractImageDocument } from '@/lib/extraction/image-extractor';
import type { SummarizeDocumentResponse } from '@/types';
import type { ExtractionProgress } from '@/types/document';
import { FileText, Sparkles, CheckCircle2 } from 'lucide-react';

export default function DocumentSummaryPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [summaryLength, setSummaryLength] = useState<SummaryLength>('medium');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('reading');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isOcr, setIsOcr] = useState(false);
  const [result, setResult] = useState<SummarizeDocumentResponse | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    setError(null);
    setResult(null);
  };

  const handleFileRemove = () => {
    setSelectedFile(null);
    setError(null);
    setResult(null);
    setIsProcessing(false);
  };

  const handleReset = () => {
    setSelectedFile(null);
    setResult(null);
    setError(null);
    setIsProcessing(false);
    setStatusMessage('');
  };

  const handleGenerate = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);
    setProcessingStep('reading');
    setStatusMessage('Reading file from browser...');

    const isImageFile =
      selectedFile.type.startsWith('image/') ||
      /\.(png|jpe?g|webp)$/i.test(selectedFile.name);
    setIsOcr(isImageFile);

    try {
      // 1. Client-Side Extraction (PDF.js / Tesseract OCR)
      setProcessingStep(isImageFile ? 'ocr' : 'extracting');
      setStatusMessage(
        isImageFile
          ? 'Running client-side Tesseract OCR on image...'
          : 'Extracting text and page structure with PDF.js...'
      );

      const progressCallback = (p: ExtractionProgress) => {
        if (p.stage === 'ocr') {
          setIsOcr(true);
          setProcessingStep('ocr');
          setStatusMessage(p.message || 'Extracting text via OCR...');
        } else if (p.stage === 'extracting') {
          setProcessingStep('extracting');
          setStatusMessage(p.message || 'Extracting document text...');
        } else if (p.stage === 'loading') {
          setProcessingStep('reading');
          setStatusMessage(p.message || 'Parsing document structure...');
        }
      };

      const extractedDoc = isImageFile
        ? await extractImageDocument(selectedFile, { onProgress: progressCallback })
        : await extractDocument(selectedFile, { onProgress: progressCallback });

      // 2. Client-Side Processing to Server API
      setProcessingStep('synthesizing');
      setStatusMessage('Sending extracted document to AI summarization service...');

      const targetChunkSize =
        summaryLength === 'short' ? 1000 : summaryLength === 'medium' ? 1800 : 2800;

      const response = await fetch('/api/documents/summarize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          extractedDocument: extractedDoc,
          options: {
            processingOptions: {
              targetChunkSize,
            },
          },
        }),
      });

      const responseData = await response.json();

      if (!response.ok || !responseData.success) {
        throw new Error(
          responseData?.error?.message ||
            `Summarization request failed with status ${response.status}.`
        );
      }

      setProcessingStep('completed');
      setResult(responseData);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred while processing the document.';
      setError({
        message: msg,
        code: isOcr ? 'OCR_FAILED' : 'SUMMARIZATION_FAILED',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        {/* Hero Section if no file/result */}
        {!selectedFile && !result && (
          <div className="text-center space-y-3 max-w-2xl mx-auto py-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <Sparkles className="size-3.5" />
              <span>Multi-Format Document Intelligence</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Intelligent Summaries in Seconds
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Upload PDF reports, research papers, resumes, or scanned image receipts. Get
              structured executive overviews, key takeaways, and section breakdowns.
            </p>
          </div>
        )}

        {/* Dynamic Workflow Area */}
        <div className="space-y-6">
          {/* 1. Upload Zone */}
          {!result && (
            <UploadZone
              selectedFile={selectedFile}
              onFileSelect={handleFileSelect}
              onFileRemove={handleFileRemove}
              disabled={isProcessing}
            />
          )}

          {/* 2. Configuration Options (Only shown when file is selected and not finished) */}
          {selectedFile && !result && !isProcessing && (
            <SummaryConfig
              length={summaryLength}
              onLengthChange={setSummaryLength}
              onGenerate={handleGenerate}
              disabled={isProcessing}
              isProcessing={isProcessing}
            />
          )}

          {/* 3. Live Processing Feedback */}
          {isProcessing && (
            <ProcessingState
              currentStep={processingStep}
              statusMessage={statusMessage}
              isOcr={isOcr}
            />
          )}

          {/* 4. Error Display */}
          {error && !isProcessing && (
            <ErrorAlert
              message={error.message}
              code={error.code}
              onRetry={handleGenerate}
              onReset={handleReset}
            />
          )}

          {/* 5. Summary Results Display */}
          {result && !isProcessing && (
            <SummaryResult data={result} onReset={handleReset} />
          )}
        </div>

        {/* Feature Highlights Footer Banner */}
        {!result && !isProcessing && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-border/60">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border/60 text-xs">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold text-foreground">In-Browser OCR</strong>
                <p className="text-muted-foreground mt-0.5">
                  Tesseract.js extracts text from scanned pages & images privately in your browser.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border/60 text-xs">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold text-foreground">Provenance Tracking</strong>
                <p className="text-muted-foreground mt-0.5">
                  Every key finding maps directly back to source page numbers and chunks.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border/60 text-xs">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold text-foreground">Export Ready</strong>
                <p className="text-muted-foreground mt-0.5">
                  One-click Markdown copy and download for executive reports and documentation.
                </p>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-border/60 py-6 mt-auto bg-card/40 text-center text-xs text-muted-foreground">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Document Summary Assistant • Technical Assessment Edition</span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <FileText className="size-3.5" />
            <span>PDF.js • Tesseract.js • NVIDIA NIM • Gemini</span>
          </span>
        </div>
      </footer>
    </div>
  );
}
