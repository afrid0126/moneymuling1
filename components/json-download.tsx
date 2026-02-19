"use client";

import { Button } from "@/components/ui/button";
import { AnalysisResult } from "@/lib/types";

interface JSONDownloadProps {
  result: AnalysisResult;
}

export function JSONDownload({ result }: JSONDownloadProps) {
  const handleDownload = () => {
    const output = {
      suspicious_accounts: result.suspicious_accounts.map((a) => ({
        account_id: a.account_id,
        suspicion_score: a.suspicion_score,
        detected_patterns: a.detected_patterns,
        ring_id: a.ring_id,
      })),
      fraud_rings: result.fraud_rings.map((r) => ({
        ring_id: r.ring_id,
        member_accounts: r.member_accounts,
        pattern_type: r.pattern_type,
        risk_score: r.risk_score,
      })),
      summary: {
        total_accounts_analyzed: result.summary.total_accounts_analyzed,
        suspicious_accounts_flagged:
          result.summary.suspicious_accounts_flagged,
        fraud_rings_detected: result.summary.fraud_rings_detected,
        processing_time_seconds: result.summary.processing_time_seconds,
      },
    };

    const blob = new Blob([JSON.stringify(output, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fraud_analysis_results.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Button onClick={handleDownload} variant="outline" size="lg">
      <svg
        className="w-4 h-4 mr-2"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Download JSON Report
    </Button>
  );
}
