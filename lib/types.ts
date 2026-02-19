export interface Transaction {
  transaction_id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  timestamp: Date;
}

export interface RawTransaction {
  transaction_id: string;
  sender_id: string;
  receiver_id: string;
  amount: string;
  timestamp: string;
}

export interface GraphNode {
  id: string;
  inDegree: number;
  outDegree: number;
  totalTransactions: number;
  totalAmountSent: number;
  totalAmountReceived: number;
  neighbors: Set<string>;
  incomingFrom: Set<string>;
  outgoingTo: Set<string>;
  transactions: Transaction[];
}

export interface GraphEdge {
  source: string;
  target: string;
  amount: number;
  timestamp: Date;
  transaction_id: string;
}

export interface DirectedGraph {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  adjacencyList: Map<string, string[]>;
}

export interface FraudRing {
  ring_id: string;
  member_accounts: string[];
  pattern_type: "cycle" | "fan_in" | "fan_out" | "smurfing" | "shell_network";
  risk_score: number;
}

export interface SuspiciousAccount {
  account_id: string;
  suspicion_score: number;
  detected_patterns: string[];
  ring_id: string;
}

export interface AnalysisSummary {
  total_accounts_analyzed: number;
  suspicious_accounts_flagged: number;
  fraud_rings_detected: number;
  processing_time_seconds: number;
}

export interface AnalysisResult {
  suspicious_accounts: SuspiciousAccount[];
  fraud_rings: FraudRing[];
  summary: AnalysisSummary;
  graph: DirectedGraph;
}

export interface DetectedCycle {
  accounts: string[];
  length: number;
}

export interface SmurfingPattern {
  hub_account: string;
  type: "fan_in" | "fan_out";
  connected_accounts: string[];
  temporal_window_hours: number;
}

export interface ShellChain {
  chain: string[];
  shell_accounts: string[];
}
