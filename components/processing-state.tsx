import React from 'react';
import { Loader2, CheckCircle2, FileSearch, Sparkles, Binary, Cpu } from 'lucide-react';

export type ProcessingStep =
  | 'reading'
  | 'extracting'
  | 'ocr'
  | 'chunking'
  | 'synthesizing'
  | 'completed';

interface ProcessingStateProps {
  currentStep: ProcessingStep;
  statusMessage?: string;
  isOcr?: boolean;
}

const STEPS = [
  { id: 'reading', label: 'Reading Document', icon: FileSearch },
  { id: 'extracting', label: 'Extracting Text', icon: Binary },
  { id: 'chunking', label: 'Processing Structure', icon: Cpu },
  { id: 'synthesizing', label: 'Synthesizing Summary', icon: Sparkles },
];

export function ProcessingState({
  currentStep,
  statusMessage,
  isOcr = false,
}: ProcessingStateProps) {
  const getStepStatus = (stepId: string): 'pending' | 'active' | 'completed' => {
    const order = ['reading', 'extracting', 'chunking', 'synthesizing', 'completed'];
    const currentIndex = order.indexOf(currentStep === 'ocr' ? 'extracting' : currentStep);
    const stepIndex = order.indexOf(stepId);

    if (currentStep === 'completed' || currentIndex > stepIndex) return 'completed';
    if (currentIndex === stepIndex) return 'active';
    return 'pending';
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 space-y-6 shadow-xs animate-in fade-in">
      <div className="text-center space-y-2">
        <div className="inline-flex size-12 rounded-2xl bg-primary/10 text-primary items-center justify-center mb-1">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
        <h3 className="text-base font-semibold text-foreground">Processing Document</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          {statusMessage ||
            (currentStep === 'synthesizing'
              ? 'Analyzing document contents and generating synthesized executive summary...'
              : 'Extracting and parsing document structure...')}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
        {STEPS.map((step) => {
          const status = getStepStatus(step.id);
          const Icon = step.icon;
          const label = step.id === 'extracting' && isOcr ? 'Tesseract OCR' : step.label;

          return (
            <div
              key={step.id}
              className={`flex items-center sm:flex-col sm:text-center gap-3 sm:gap-2 p-3 rounded-xl border transition-all ${
                status === 'active'
                  ? 'border-primary bg-primary/5 text-primary'
                  : status === 'completed'
                  ? 'border-border/60 bg-muted/30 text-muted-foreground'
                  : 'border-transparent bg-muted/10 text-muted-foreground/50 opacity-60'
              }`}
            >
              <div className="shrink-0">
                {status === 'completed' ? (
                  <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" />
                ) : status === 'active' ? (
                  <Loader2 className="size-5 animate-spin text-primary" />
                ) : (
                  <Icon className="size-5" />
                )}
              </div>
              <span className="text-xs font-medium">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
