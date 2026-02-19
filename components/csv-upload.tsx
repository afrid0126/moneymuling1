"use client";

import { useCallback, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface CSVUploadProps {
  onFileSelect: (file: File) => void;
  isProcessing: boolean;
  statusMessage?: string;
}

export function CSVUpload({
  onFileSelect,
  isProcessing,
  statusMessage,
}: CSVUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file && file.name.endsWith(".csv")) {
        setFileName(file.name);
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setFileName(file.name);
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  return (
    <Card
      className={`border-2 border-dashed transition-colors cursor-pointer ${
        isDragging
          ? "border-red-500 bg-red-500/10"
          : "border-muted-foreground/25 hover:border-red-500/50"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
        {isProcessing ? (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-red-500 border-t-transparent" />
            <p className="text-lg text-muted-foreground">
              {statusMessage || "Analyzing transactions..."}
            </p>
          </>
        ) : (
          <>
            <div className="text-6xl opacity-30">
              <svg
                width="64"
                height="64"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-lg font-medium">
                {fileName
                  ? `Selected: ${fileName}`
                  : "Drop your CSV file here"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Required columns: transaction_id, sender_id, receiver_id,
                amount, timestamp
              </p>
            </div>
            <label>
              <Button variant="outline" className="mt-2" asChild>
                <span>Browse Files</span>
              </Button>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileInput}
              />
            </label>
          </>
        )}
      </CardContent>
    </Card>
  );
}
