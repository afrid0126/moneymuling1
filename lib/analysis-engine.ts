import { Transaction, AnalysisResult } from "./types";
import { buildGraph } from "./graph-builder";
import { detectCycles } from "./cycle-detector";
import { detectSmurfing } from "./smurfing-detector";
import { detectShellNetworks } from "./shell-detector";
import { computeScores } from "./scoring-engine";

export function analyzeTransactions(
  transactions: Transaction[]
): AnalysisResult {
  const startTime = performance.now();

  console.log(`[Analysis] Starting analysis of ${transactions.length} transactions...`);
  const graph = buildGraph(transactions);
  console.log(`[Analysis] Graph built: ${graph.nodes.size} nodes, ${graph.edges.length} edges`);

  console.log(`[Analysis] Running cycle detector...`);
  const t1 = performance.now();
  const cycles = detectCycles(graph);
  console.log(`[Analysis] Cycle detector done: ${cycles.length} cycles found (${((performance.now() - t1) / 1000).toFixed(2)}s)`);
  cycles.forEach((c, i) => console.log(`  Cycle ${i + 1}: [${c.accounts.join(" -> ")}] (length ${c.length})`));

  console.log(`[Analysis] Running smurfing detector...`);
  const t2 = performance.now();
  const smurfingPatterns = detectSmurfing(graph);
  console.log(`[Analysis] Smurfing detector done: ${smurfingPatterns.length} patterns found (${((performance.now() - t2) / 1000).toFixed(2)}s)`);
  smurfingPatterns.forEach((p, i) => console.log(`  Pattern ${i + 1}: ${p.type} hub=${p.hub_account} connections=${p.connected_accounts.length} window=${p.temporal_window_hours}h`));

  console.log(`[Analysis] Running shell network detector...`);
  const t3 = performance.now();
  const shellChains = detectShellNetworks(graph);
  console.log(`[Analysis] Shell detector done: ${shellChains.length} chains found (${((performance.now() - t3) / 1000).toFixed(2)}s)`);
  shellChains.forEach((c, i) => console.log(`  Chain ${i + 1}: [${c.chain.join(" -> ")}] shells=[${c.shell_accounts.join(", ")}]`));

  console.log(`[Analysis] Computing suspicion scores...`);
  const { suspiciousAccounts, fraudRings } = computeScores(
    graph,
    cycles,
    smurfingPatterns,
    shellChains
  );

  const endTime = performance.now();
  const processingTime =
    Math.round(((endTime - startTime) / 1000) * 10) / 10;

  console.log(`[Analysis] === RESULTS ===`);
  console.log(`[Analysis] Total accounts: ${graph.nodes.size}`);
  console.log(`[Analysis] Suspicious accounts: ${suspiciousAccounts.length}`);
  console.log(`[Analysis] Fraud rings: ${fraudRings.length}`);
  console.log(`[Analysis] Processing time: ${processingTime}s`);

  if (suspiciousAccounts.length > 0) {
    console.log(`[Analysis] Top suspicious accounts:`);
    suspiciousAccounts.slice(0, 10).forEach((a) =>
      console.log(`  ${a.account_id}: score=${a.suspicion_score} patterns=[${a.detected_patterns.join(", ")}] ring=${a.ring_id}`)
    );
  }

  if (fraudRings.length > 0) {
    console.log(`[Analysis] Detected fraud rings:`);
    fraudRings.forEach((r) =>
      console.log(`  ${r.ring_id}: type=${r.pattern_type} members=${r.member_accounts.length} risk=${r.risk_score}`)
    );
  }

  return {
    suspicious_accounts: suspiciousAccounts,
    fraud_rings: fraudRings,
    summary: {
      total_accounts_analyzed: graph.nodes.size,
      suspicious_accounts_flagged: suspiciousAccounts.length,
      fraud_rings_detected: fraudRings.length,
      processing_time_seconds: processingTime,
    },
    graph,
  };
}
