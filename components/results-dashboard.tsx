"use client";

import { Card, CardContent } from "@/components/ui/card";
import { GraphVisualization } from "./graph-visualization";
import { FraudRingTable } from "./fraud-ring-table";
import { JSONDownload } from "./json-download";
import { AnalysisResult } from "@/lib/types";

interface ResultsDashboardProps {
  result: AnalysisResult;
  onReset: () => void;
}

export function ResultsDashboard({ result, onReset }: ResultsDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Accounts Analyzed</p>
            <p className="text-3xl font-bold">
              {result.summary.total_accounts_analyzed}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Suspicious Accounts
            </p>
            <p className="text-3xl font-bold text-red-400">
              {result.summary.suspicious_accounts_flagged}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Fraud Rings</p>
            <p className="text-3xl font-bold text-orange-400">
              {result.summary.fraud_rings_detected}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Processing Time</p>
            <p className="text-3xl font-bold">
              {result.summary.processing_time_seconds}s
            </p>
          </CardContent>
        </Card>
      </div>

      <GraphVisualization result={result} />

      <FraudRingTable rings={result.fraud_rings} />

      <div className="flex items-center gap-4">
        <JSONDownload result={result} />
        <button
          onClick={onReset}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors underline"
        >
          Upload another file
        </button>
      </div>
    </div>
  );
}
