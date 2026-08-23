import React from 'react';
import { FileText, Sparkles, ShieldCheck } from 'lucide-react';

export function Header() {
  return (
    <header className="border-b border-border/80 bg-card/60 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
            <FileText className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-base text-foreground tracking-tight">
                Document Summary Assistant
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                <Sparkles className="size-3" />
                AI Intelligence
              </span>
            </div>
            <p className="text-xs text-muted-foreground hidden sm:block">
              Fast document synthesis with in-browser OCR & structured AI extraction
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="hidden md:flex items-center gap-1.5 bg-muted/60 px-2.5 py-1 rounded-md border border-border/60">
            <ShieldCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>In-Memory Privacy</span>
          </div>
        </div>
      </div>
    </header>
  );
}
