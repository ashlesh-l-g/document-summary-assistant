import React from 'react';
import { Sparkles, AlignLeft, Layers, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type SummaryLength = 'short' | 'medium' | 'long';

interface SummaryConfigProps {
  length: SummaryLength;
  onLengthChange: (length: SummaryLength) => void;
  onGenerate: () => void;
  disabled?: boolean;
  isProcessing?: boolean;
}

const LENGTH_OPTIONS: Array<{
  id: SummaryLength;
  label: string;
  badge: string;
  description: string;
  icon: typeof AlignLeft;
}> = [
  {
    id: 'short',
    label: 'Short',
    badge: 'TL;DR',
    description: 'High-level executive overview with top key takeaways.',
    icon: AlignLeft,
  },
  {
    id: 'medium',
    label: 'Medium',
    badge: 'Executive',
    description: 'Standard synthesis with balanced thematic sections and findings.',
    icon: FileText,
  },
  {
    id: 'long',
    label: 'Long',
    badge: 'In-Depth',
    description: 'Detailed, comprehensive analysis with extensive section insights.',
    icon: Layers,
  },
];

export function SummaryConfig({
  length,
  onLengthChange,
  onGenerate,
  disabled = false,
  isProcessing = false,
}: SummaryConfigProps) {
  return (
    <div className="space-y-5 bg-card border border-border rounded-2xl p-5 shadow-xs">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Summary Length & Detail</h3>
        <p className="text-xs text-muted-foreground">
          Choose how comprehensive and detailed you want the generated summary to be.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {LENGTH_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const isSelected = length === opt.id;

          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onLengthChange(opt.id)}
              disabled={disabled || isProcessing}
              className={`flex flex-col text-left p-3.5 rounded-xl border transition-all relative focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary shadow-xs'
                  : 'border-border/80 hover:border-border hover:bg-muted/40 bg-card'
              } ${disabled || isProcessing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <div className="flex items-center gap-2">
                  <Icon
                    className={`size-4 ${
                      isSelected ? 'text-primary' : 'text-muted-foreground'
                    }`}
                  />
                  <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                </div>
                <span
                  className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded ${
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {opt.badge}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {opt.description}
              </p>
            </button>
          );
        })}
      </div>

      <div className="pt-2">
        <Button
          type="button"
          size="lg"
          onClick={onGenerate}
          disabled={disabled || isProcessing}
          className="w-full h-11 text-sm font-semibold gap-2 shadow-sm rounded-xl cursor-pointer"
        >
          <Sparkles className="size-4.5" />
          <span>{isProcessing ? 'Summarizing Document...' : 'Generate Document Summary'}</span>
        </Button>
      </div>
    </div>
  );
}
