import React from 'react';
import { AlertTriangle, RotateCcw, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorAlertProps {
  message: string;
  code?: string;
  onRetry?: () => void;
  onReset?: () => void;
}

export function ErrorAlert({
  message,
  code,
  onRetry,
  onReset,
}: ErrorAlertProps) {
  return (
    <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-6 space-y-4 shadow-xs animate-in fade-in">
      <div className="flex items-start gap-3.5">
        <div className="size-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0 mt-0.5">
          <AlertTriangle className="size-5" />
        </div>
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-sm font-semibold text-foreground">Processing Issue</h4>
            {code && (
              <span className="font-mono text-[10px] bg-destructive/15 text-destructive font-medium px-2 py-0.5 rounded">
                {code}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {message}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-destructive/10">
        {onRetry && (
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={onRetry}
            className="gap-1.5"
          >
            <RotateCcw className="size-3.5" />
            <span>Try Again</span>
          </Button>
        )}
        {onReset && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onReset}
            className="gap-1.5"
          >
            <ArrowLeft className="size-3.5" />
            <span>Select Another File</span>
          </Button>
        )}
      </div>
    </div>
  );
}
