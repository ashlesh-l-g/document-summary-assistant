import React, { useRef, useState, useCallback } from 'react';
import { UploadCloud, File, Image as ImageIcon, X, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/lib/format-utils';
import { MAX_FILE_SIZE_BYTES } from '@/lib/validation/file-validation';

interface UploadZoneProps {
  selectedFile: File | null;
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  disabled?: boolean;
}

const ACCEPTED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp'];
const ACCEPTED_MIMES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
];

export function UploadZone({
  selectedFile,
  onFileSelect,
  onFileRemove,
  disabled = false,
}: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndHandleFile = useCallback(
    (file: File) => {
      setValidationError(null);

      // 1. Size validation
      if (file.size === 0) {
        setValidationError('Selected file is empty (0 bytes). Please select a valid document.');
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setValidationError(
          `File size (${formatBytes(file.size)}) exceeds the maximum limit of 20MB.`
        );
        return;
      }

      // 2. Type validation
      const hasValidExt = ACCEPTED_EXTENSIONS.some((ext) =>
        file.name.toLowerCase().endsWith(ext)
      );
      const hasValidMime = ACCEPTED_MIMES.includes(file.type.toLowerCase());

      if (!hasValidExt && !hasValidMime) {
        setValidationError(
          'Unsupported file format. Please upload a PDF document or an image (PNG, JPG, WEBP).'
        );
        return;
      }

      onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      validateAndHandleFile(files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndHandleFile(files[0]);
    }
    // Reset input value so re-uploading the same file works
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const isImage = selectedFile
    ? selectedFile.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(selectedFile.name)
    : false;

  return (
    <div className="w-full space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleFileInputChange}
        disabled={disabled}
        aria-label="Upload document file"
      />

      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          tabIndex={disabled ? -1 : 0}
          role="button"
          aria-label="Drag and drop or click to upload PDF or image"
          className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-10 text-center cursor-pointer transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            isDragOver
              ? 'border-primary bg-primary/5 scale-[0.99]'
              : 'border-border/80 hover:border-primary/60 hover:bg-muted/40 bg-card'
          } ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
        >
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="size-14 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
              <UploadCloud className="size-7 text-primary" />
            </div>

            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">
                <span className="text-primary hover:underline">Click to upload</span> or drag and drop
              </p>
              <p className="text-xs text-muted-foreground">
                PDF documents or scanned images (PNG, JPG, WEBP) up to 20MB
              </p>
            </div>

            <div className="flex items-center gap-2 pt-2 text-[11px] text-muted-foreground">
              <span className="bg-muted px-2 py-0.5 rounded-md font-mono">PDF</span>
              <span className="bg-muted px-2 py-0.5 rounded-md font-mono">PNG</span>
              <span className="bg-muted px-2 py-0.5 rounded-md font-mono">JPG</span>
              <span className="bg-muted px-2 py-0.5 rounded-md font-mono">WEBP</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="border border-border rounded-2xl p-4 bg-card shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="size-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              {isImage ? <ImageIcon className="size-6" /> : <File className="size-6" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{selectedFile.name}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{formatBytes(selectedFile.size)}</span>
                <span>•</span>
                <span className="uppercase font-mono text-[10px] bg-muted px-1.5 py-0.2 rounded">
                  {isImage ? 'Image (OCR)' : 'PDF Document'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
            >
              Replace
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={onFileRemove}
              disabled={disabled}
              aria-label="Remove selected file"
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {validationError && (
        <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-3 rounded-lg border border-destructive/20 animate-in fade-in">
          <AlertCircle className="size-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}
    </div>
  );
}
