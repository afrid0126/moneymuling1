import {
  DirectedGraph,
  DetectedCycle,
  SmurfingPattern,
  ShellChain,
  SuspiciousAccount,
  FraudRing,
} from "./types";

interface AccountScore {
  account_id: string;
  baseScore: number;
  patterns: string[];
  ringIds: string[];
}

export function computeScores(
  graph: DirectedGraph,
  cycles: DetectedCycle[],
  smurfingPatterns: SmurfingPattern[],
  shellChains: ShellChain[]
): { suspiciousAccounts: SuspiciousAccount[]; fraudRings: FraudRing[] } {
  const accountScores = new Map<string, AccountScore>();
  const fraudRings: FraudRing[] = [];
  let ringCounter = 1;

  function getOrCreate(id: string): AccountScore {
    if (!accountScores.has(id)) {
      accountScores.set(id, {
        account_id: id,
        baseScore: 0,
        patterns: [],
        ringIds: [],
      });
    }
    return accountScores.get(id)!;
  }

  for (const cycle of cycles) {
    const ringId = `RING_${String(ringCounter).padStart(3, "0")}`;
    ringCounter++;

    const cycleLengthBonus = cycle.length === 3 ? 45 : cycle.length === 4 ? 40 : 35;

    for (const accountId of cycle.accounts) {
      const score = getOrCreate(accountId);
      score.baseScore += cycleLengthBonus;
      score.patterns.push(`cycle_length_${cycle.length}`);
      score.ringIds.push(ringId);
    }

    const riskScore = Math.min(
      100,
      cycleLengthBonus + 30 + (cycle.length === 3 ? 20 : 10)
    );

    fraudRings.push({
      ring_id: ringId,
      member_accounts: [...cycle.accounts],
      pattern_type: "cycle",
      risk_score: Math.round(riskScore * 10) / 10,
    });
  }

  for (const pattern of smurfingPatterns) {
    const ringId = `RING_${String(ringCounter).padStart(3, "0")}`;
    ringCounter++;

    const hubScore = getOrCreate(pattern.hub_account);
    const patternName =
      pattern.type === "fan_in" ? "fan_in_hub" : "fan_out_hub";
    hubScore.baseScore += 35;
    hubScore.patterns.push(patternName);
    if (pattern.temporal_window_hours > 0) {
      hubScore.baseScore += 15;
      hubScore.patterns.push("high_velocity");
    }
    hubScore.ringIds.push(ringId);

    const memberAccounts = [
      pattern.hub_account,
      ...pattern.connected_accounts,
    ];

    for (const accountId of pattern.connected_accounts) {
      const score = getOrCreate(accountId);
      score.baseScore += 15;
      score.patterns.push(
        pattern.type === "fan_in" ? "smurfing_sender" : "smurfing_receiver"
      );
      score.ringIds.push(ringId);
    }

    const riskScore = pattern.temporal_window_hours > 0 ? 85 : 70;

    fraudRings.push({
      ring_id: ringId,
      member_accounts: memberAccounts,
      pattern_type: pattern.type,
      risk_score: riskScore,
    });
  }

  for (const chain of shellChains) {
    const ringId = `RING_${String(ringCounter).padStart(3, "0")}`;
    ringCounter++;

    for (const shellId of chain.shell_accounts) {
      const score = getOrCreate(shellId);
      score.baseScore += 30;
      score.patterns.push("shell_intermediary");
      score.ringIds.push(ringId);
    }

    const endpoints = [chain.chain[0], chain.chain[chain.chain.length - 1]];
    for (const endId of endpoints) {
      const score = getOrCreate(endId);
      score.baseScore += 20;
      score.patterns.push("shell_network_endpoint");
      score.ringIds.push(ringId);
    }

    fraudRings.push({
      ring_id: ringId,
      member_accounts: [...chain.chain],
      pattern_type: "shell_network",
      risk_score: 75,
    });
  }

  for (const [accountId, node] of graph.nodes) {
    if (!accountScores.has(accountId)) continue;

    const score = accountScores.get(accountId)!;
    const txns = node.transactions;

    if (txns.length >= 2) {
      const sorted = [...txns].sort(
        (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
      );
      const timeSpanHours =
        (sorted[sorted.length - 1].timestamp.getTime() -
          sorted[0].timestamp.getTime()) /
        (1000 * 60 * 60);

      if (timeSpanHours > 0 && txns.length / timeSpanHours > 2) {
        if (!score.patterns.includes("high_velocity")) {
          score.baseScore += 10;
          score.patterns.push("high_velocity");
        }
      }
    }

    const suspiciousAmounts = node.transactions.filter((t) => {
      const amt = t.amount;
      const isRound = amt >= 1000 && amt % 1000 === 0;
      const isJustUnder =
        (amt >= 9900 && amt < 10000) || (amt >= 4900 && amt < 5000);
      return isRound || isJustUnder;
    });

    if (suspiciousAmounts.length > 0) {
      score.baseScore += 5;
      if (!score.patterns.includes("amount_anomaly")) {
        score.patterns.push("amount_anomaly");
      }
    }
  }

  const suspiciousAccounts: SuspiciousAccount[] = [];

  for (const [, score] of accountScores) {
    const uniquePatternTypes = new Set(
      score.patterns.map((p) => {
        if (p.startsWith("cycle")) return "cycle";
        if (p.includes("fan_") || p.includes("smurfing")) return "smurfing";
        if (p.includes("shell")) return "shell";
        return p;
      })
    );

    let finalScore = score.baseScore;
    if (uniquePatternTypes.size >= 2) {
      finalScore *= 1.3;
    }

    finalScore = Math.min(100, Math.round(finalScore * 10) / 10);

    const uniquePatterns = [...new Set(score.patterns)];

    suspiciousAccounts.push({
      account_id: score.account_id,
      suspicion_score: finalScore,
      detected_patterns: uniquePatterns,
      ring_id: score.ringIds[0] || "",
    });
  }

  suspiciousAccounts.sort((a, b) => b.suspicion_score - a.suspicion_score);

  return { suspiciousAccounts, fraudRings };
}
