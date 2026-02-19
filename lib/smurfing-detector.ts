import { DirectedGraph, SmurfingPattern, Transaction } from "./types";

const FAN_THRESHOLD = 10;
const TEMPORAL_WINDOW_MS = 72 * 60 * 60 * 1000;

export function detectSmurfing(graph: DirectedGraph): SmurfingPattern[] {
  const patterns: SmurfingPattern[] = [];

  for (const [nodeId, node] of graph.nodes) {
    if (node.incomingFrom.size >= FAN_THRESHOLD) {
      const temporalClusters = getTemporalClusters(
        node.transactions.filter((t) => t.receiver_id === nodeId),
        TEMPORAL_WINDOW_MS
      );

      for (const cluster of temporalClusters) {
        const uniqueSenders = new Set(cluster.map((t) => t.sender_id));
        if (uniqueSenders.size >= FAN_THRESHOLD) {
          if (!isLikelyLegitimate(node, graph, "fan_in")) {
            patterns.push({
              hub_account: nodeId,
              type: "fan_in",
              connected_accounts: Array.from(uniqueSenders),
              temporal_window_hours: 72,
            });
          }
        }
      }

      if (
        patterns.filter((p) => p.hub_account === nodeId && p.type === "fan_in")
          .length === 0 &&
        node.incomingFrom.size >= FAN_THRESHOLD &&
        !isLikelyLegitimate(node, graph, "fan_in")
      ) {
        patterns.push({
          hub_account: nodeId,
          type: "fan_in",
          connected_accounts: Array.from(node.incomingFrom),
          temporal_window_hours: -1,
        });
      }
    }

    if (node.outgoingTo.size >= FAN_THRESHOLD) {
      const temporalClusters = getTemporalClusters(
        node.transactions.filter((t) => t.sender_id === nodeId),
        TEMPORAL_WINDOW_MS
      );

      for (const cluster of temporalClusters) {
        const uniqueReceivers = new Set(cluster.map((t) => t.receiver_id));
        if (uniqueReceivers.size >= FAN_THRESHOLD) {
          if (!isLikelyLegitimate(node, graph, "fan_out")) {
            patterns.push({
              hub_account: nodeId,
              type: "fan_out",
              connected_accounts: Array.from(uniqueReceivers),
              temporal_window_hours: 72,
            });
          }
        }
      }

      if (
        patterns.filter(
          (p) => p.hub_account === nodeId && p.type === "fan_out"
        ).length === 0 &&
        node.outgoingTo.size >= FAN_THRESHOLD &&
        !isLikelyLegitimate(node, graph, "fan_out")
      ) {
        patterns.push({
          hub_account: nodeId,
          type: "fan_out",
          connected_accounts: Array.from(node.outgoingTo),
          temporal_window_hours: -1,
        });
      }
    }
  }

  return patterns;
}

function getTemporalClusters(
  transactions: Transaction[],
  windowMs: number
): Transaction[][] {
  if (transactions.length === 0) return [];

  const sorted = [...transactions].sort(
    (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
  );

  const clusters: Transaction[][] = [];

  for (let i = 0; i < sorted.length; i++) {
    const cluster: Transaction[] = [sorted[i]];
    const windowEnd = sorted[i].timestamp.getTime() + windowMs;

    for (let j = i + 1; j < sorted.length; j++) {
      if (sorted[j].timestamp.getTime() <= windowEnd) {
        cluster.push(sorted[j]);
      } else {
        break;
      }
    }

    if (cluster.length >= FAN_THRESHOLD) {
      clusters.push(cluster);
      i += Math.floor(cluster.length / 2);
    }
  }

  return clusters;
}

function isLikelyLegitimate(
  node: ReturnType<typeof Object>,
  _graph: DirectedGraph,
  type: "fan_in" | "fan_out"
): boolean {
  const n = node as any;

  if (type === "fan_in") {
    const sendRatio = n.outDegree / Math.max(n.inDegree, 1);
    if (sendRatio < 0.05) {
      const amounts = n.transactions
        .filter((t: Transaction) => t.receiver_id === n.id)
        .map((t: Transaction) => t.amount);
      if (hasUniformAmounts(amounts)) return true;
    }
  }

  if (type === "fan_out") {
    const receiveRatio = n.inDegree / Math.max(n.outDegree, 1);
    if (receiveRatio < 0.05) {
      const amounts = n.transactions
        .filter((t: Transaction) => t.sender_id === n.id)
        .map((t: Transaction) => t.amount);
      if (hasUniformAmounts(amounts) && amounts.length > 20) return true;
    }
  }

  return false;
}

function hasUniformAmounts(amounts: number[]): boolean {
  if (amounts.length < 5) return false;

  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  if (mean === 0) return false;

  const variance =
    amounts.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    amounts.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;

  return cv < 0.1;
}
