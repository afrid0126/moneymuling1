import { DirectedGraph, DetectedCycle, GraphEdge } from "./types";

const MAX_CYCLE_LENGTH = 5;
const MIN_CYCLE_LENGTH = 3;

const AMOUNT_DECAY_THRESHOLD = 0.5;
const TEMPORAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export function detectCycles(graph: DirectedGraph): DetectedCycle[] {
  const rawCycles: string[][] = [];
  const seen = new Set<string>();
  const allNodes = Array.from(graph.adjacencyList.keys());

  for (const startNode of allNodes) {
    const path: string[] = [startNode];
    const visited = new Set<string>([startNode]);
    dfs(startNode, startNode, path, visited, graph, rawCycles, seen);
  }

  console.log(`[Cycle Detector] Raw structural cycles found: ${rawCycles.length}`);

  const validated: DetectedCycle[] = [];

  for (const cycle of rawCycles) {
    if (isSuspiciousCycle(cycle, graph)) {
      validated.push({ accounts: cycle, length: cycle.length });
    }
  }

  console.log(`[Cycle Detector] After amount/temporal validation: ${validated.length} suspicious cycles`);
  return validated;
}

function dfs(
  current: string,
  start: string,
  path: string[],
  visited: Set<string>,
  graph: DirectedGraph,
  cycles: string[][],
  seen: Set<string>
): void {
  const neighbors = graph.adjacencyList.get(current) || [];

  for (const neighbor of neighbors) {
    if (neighbor === start && path.length >= MIN_CYCLE_LENGTH && path.length <= MAX_CYCLE_LENGTH) {
      const cyclePath = [...path];
      const canonical = getCanonicalForm(cyclePath);

      if (!seen.has(canonical)) {
        seen.add(canonical);
        cycles.push(cyclePath);
      }
      continue;
    }

    if (!visited.has(neighbor) && path.length < MAX_CYCLE_LENGTH) {
      visited.add(neighbor);
      path.push(neighbor);
      dfs(neighbor, start, path, visited, graph, cycles, seen);
      path.pop();
      visited.delete(neighbor);
    }
  }
}

function isSuspiciousCycle(cycle: string[], graph: DirectedGraph): boolean {
  const edgesByPair = new Map<string, GraphEdge[]>();

  for (const edge of graph.edges) {
    const key = `${edge.source}->${edge.target}`;
    if (!edgesByPair.has(key)) edgesByPair.set(key, []);
    edgesByPair.get(key)!.push(edge);
  }

  const hopEdges: GraphEdge[] = [];

  for (let i = 0; i < cycle.length; i++) {
    const from = cycle[i];
    const to = cycle[(i + 1) % cycle.length];
    const key = `${from}->${to}`;
    const candidates = edgesByPair.get(key);

    if (!candidates || candidates.length === 0) return false;

    const best = candidates.reduce((a, b) => (a.amount > b.amount ? a : b));
    hopEdges.push(best);
  }

  if (hopEdges.length !== cycle.length) return false;

  for (let i = 1; i < hopEdges.length; i++) {
    const prev = hopEdges[i - 1].amount;
    const curr = hopEdges[i].amount;
    if (prev === 0) continue;
    const ratio = curr / prev;
    if (ratio < AMOUNT_DECAY_THRESHOLD) {
      return false;
    }
  }

  const lastAmount = hopEdges[hopEdges.length - 1].amount;
  const firstAmount = hopEdges[0].amount;
  if (firstAmount > 0 && lastAmount / firstAmount < AMOUNT_DECAY_THRESHOLD) {
    return false;
  }

  const timestamps = hopEdges.map((e) => e.timestamp.getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);

  if (maxTime - minTime > TEMPORAL_WINDOW_MS) {
    return false;
  }

  return true;
}

function getCanonicalForm(cycle: string[]): string {
  let minIdx = 0;
  for (let i = 1; i < cycle.length; i++) {
    if (cycle[i] < cycle[minIdx]) {
      minIdx = i;
    }
  }
  const rotated = [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)];
  return rotated.join("->");
}
