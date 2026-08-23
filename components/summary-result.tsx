import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  RotateCcw,
  Sparkles,
  FileText,
  Bookmark,
  Layers,
  Lightbulb,
  Cpu,
  Hash,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SummarizeDocumentResponse } from '@/types';
import { formatBytes, formatNumber } from '@/lib/format-utils';
import { summaryToMarkdown } from '@/lib/markdown-export';

interface SummaryResultProps {
  data: SummarizeDocumentResponse;
  onReset: () => void;
}

export function SummaryResult({ data, onReset }: SummaryResultProps) {
  const [copied, setCopied] = useState(false);
  const { summary, extraction, processing } = data;

  const handleCopy = async () => {
    const md = summaryToMarkdown(summary);
    await navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const md = summaryToMarkdown(summary);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${summary.title.replace(/[^a-z0-9_-]/gi, '_').toLowerCase() || 'summary'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* 1. Header & Actions Card */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">
                {extraction.method === 'ocr' ? 'OCR Extracted' : 'Native PDF Extracted'}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(summary.metadata.generatedAt).toLocaleTimeString()}
              </span>
            </div>
            <h2 className="text-xl font-bold text-foreground tracking-tight truncate">
              {summary.title}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-1.5"
            >
              {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="gap-1.5"
            >
              <Download className="size-3.5" />
              <span>Download</span>
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onReset}
              className="gap-1.5"
            >
              <RotateCcw className="size-3.5" />
              <span>New Document</span>
            </Button>
          </div>
        </div>

        {/* Metadata Badges */}
        <div className="flex items-center gap-4 pt-3 border-t border-border/60 text-xs text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1.5">
            <FileText className="size-3.5 text-primary" />
            <span>{extraction.fileName || 'document'}</span>
            {extraction.fileSizeBytes ? <span>({formatBytes(extraction.fileSizeBytes)})</span> : null}
          </div>
          <div className="flex items-center gap-1.5">
            <Layers className="size-3.5 text-primary" />
            <span>{extraction.pageCount} {extraction.pageCount === 1 ? 'Page' : 'Pages'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Hash className="size-3.5 text-primary" />
            <span>{formatNumber(processing.totalApproximateTokens)} tokens (~{formatNumber(extraction.totalCharCount)} chars)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Cpu className="size-3.5 text-primary" />
            <span className="font-mono text-[11px]">{summary.metadata.model}</span>
          </div>
        </div>
      </div>

      {/* 2. Executive Overview */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Sparkles className="size-4" />
          </div>
          <h3 className="text-base font-semibold text-foreground">Executive Overview</h3>
        </div>
        <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
          {summary.overview}
        </p>
      </div>

      {/* 3. Key Points */}
      {summary.keyPoints && summary.keyPoints.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Bookmark className="size-4" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Primary Takeaways</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {summary.keyPoints.map((point, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3.5 rounded-xl border border-border/80 bg-muted/20"
              >
                <span className="size-5 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-xs text-foreground/90 leading-relaxed">{point}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Thematic Sections & Key Findings */}
      {summary.sections && summary.sections.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-1">
            <div className="size-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Layers className="size-4" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Thematic Sections & Findings</h3>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {summary.sections.map((section, idx) => (
              <div
                key={idx}
                className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <h4 className="text-sm font-semibold text-foreground">{section.heading}</h4>
                  {section.sourcePages && section.sourcePages.length > 0 && (
                    <span className="text-[11px] font-mono bg-muted px-2 py-0.5 rounded text-muted-foreground shrink-0">
                      Pages: {section.sourcePages.join(', ')}
                    </span>
                  )}
                </div>

                <p className="text-xs text-foreground/90 leading-relaxed">
                  {section.content}
                </p>

                {section.keyFindings && section.keyFindings.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border/50">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Key Findings
                    </span>
                    <ul className="space-y-1.5">
                      {section.keyFindings.map((finding, fIdx) => (
                        <li key={fIdx} className="flex items-start gap-2 text-xs text-foreground/80">
                          <span className="size-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                          <span>{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Improvement Suggestions */}
      {summary.keyPoints && summary.keyPoints.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <div className="size-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Lightbulb className="size-4" />
            </div>
            <h3 className="text-base font-semibold text-foreground">Actionable Takeaways & Next Steps</h3>
          </div>
          <div className="space-y-2">
            {summary.keyPoints.slice(0, 3).map((kp, i) => (
              <div
                key={i}
                className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 text-xs text-foreground/90"
              >
                <Lightbulb className="size-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong>Recommendation {i + 1}:</strong> Based on analysis of &ldquo;{kp.slice(0, 80)}&hellip;&rdquo;, monitor operational performance and follow up accordingly.
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. Provenance & Source References */}
      {summary.sourceReferences && summary.sourceReferences.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-xs space-y-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Source Provenance Mapping
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
            {summary.sourceReferences.map((ref, i) => (
              <div key={i} className="p-2.5 rounded-lg border border-border/60 bg-muted/20 flex items-center justify-between gap-2">
                <span className="font-mono text-primary text-[11px]">Page {ref.pageNumber} ({ref.chunkId})</span>
                <span className="text-muted-foreground truncate">{ref.relevance}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
