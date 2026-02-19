"use client";

import { useState } from "react";
import { CSVUpload } from "@/components/csv-upload";
import { ResultsDashboard } from "@/components/results-dashboard";
import { parseCSV } from "@/lib/csv-parser";
import { analyzeTransactions } from "@/lib/analysis-engine";
import { AnalysisResult } from "@/lib/types";

const MAX_ROWS = 10000;

export default function Home() {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async (file: File) => {
    setIsProcessing(true);
    setError(null);
    setStatus("Parsing CSV file...");
    console.log(`[App] File selected: ${file.name} (${file.size} bytes)`);

    try {
      await new Promise((r) => setTimeout(r, 50));

      console.log(`[App] Parsing CSV...`);
      let transactions = await parseCSV(file);
      console.log(`[App] CSV parsed: ${transactions.length} transactions`);

      if (transactions.length === 0) {
        throw new Error(
          "No valid transactions found in CSV. Check that your file has the required columns: transaction_id, sender_id, receiver_id, amount, timestamp"
        );
      }

      if (transactions.length > MAX_ROWS) {
        console.warn(
          `[App] Capping transactions from ${transactions.length} to ${MAX_ROWS}`
        );
        setStatus(
          `Large file detected (${transactions.length} rows). Processing first ${MAX_ROWS}...`
        );
        transactions = transactions.slice(0, MAX_ROWS);
        await new Promise((r) => setTimeout(r, 50));
      }

      setStatus(
        `Analyzing ${transactions.length} transactions... Building graph...`
      );
      await new Promise((r) => setTimeout(r, 50));

      console.log(`[App] Running analysis engine...`);
      const analysisResult = await new Promise<AnalysisResult>(
        (resolve, reject) => {
          setTimeout(() => {
            try {
              const result = analyzeTransactions(transactions);
              resolve(result);
            } catch (err) {
              reject(err);
            }
          }, 0);
        }
      );

      console.log(`[App] Analysis complete! Results ready.`);
      setResult(analysisResult);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "An unknown error occurred";
      console.error(`[App] Error during processing:`, err);
      setError(message);
    } finally {
      setIsProcessing(false);
      setStatus("");
    }
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold tracking-tight">
            <span className="text-red-500">Money Muling</span> Detector
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Graph-based financial crime detection engine
          </p>
          <p className="text-muted-foreground/60 text-sm mt-1">
            Detects circular fund routing, smurfing patterns, and shell networks
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-center">
            {error}
          </div>
        )}

        {result ? (
          <ResultsDashboard result={result} onReset={handleReset} />
        ) : (
          <div className="max-w-2xl mx-auto">
            <CSVUpload
              onFileSelect={handleFileSelect}
              isProcessing={isProcessing}
              statusMessage={status}
            />

            <div className="mt-8 text-center text-sm text-muted-foreground space-y-1">
              <p>
                Upload a CSV file with transaction data to begin analysis.
              </p>
              <p>
                The engine will detect fraud rings using cycle detection,
                fan-in/fan-out analysis, and shell network identification.
              </p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
