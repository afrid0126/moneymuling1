import { Transaction, DirectedGraph, GraphNode, GraphEdge } from "./types";

export function buildGraph(transactions: Transaction[]): DirectedGraph {
  const nodes = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const adjacencyList = new Map<string, string[]>();

  function getOrCreateNode(id: string): GraphNode {
    if (!nodes.has(id)) {
      nodes.set(id, {
        id,
        inDegree: 0,
        outDegree: 0,
        totalTransactions: 0,
        totalAmountSent: 0,
        totalAmountReceived: 0,
        neighbors: new Set(),
        incomingFrom: new Set(),
        outgoingTo: new Set(),
        transactions: [],
      });
    }
    return nodes.get(id)!;
  }

  for (const txn of transactions) {
    const sender = getOrCreateNode(txn.sender_id);
    const receiver = getOrCreateNode(txn.receiver_id);

    sender.outDegree++;
    sender.totalTransactions++;
    sender.totalAmountSent += txn.amount;
    sender.neighbors.add(txn.receiver_id);
    sender.outgoingTo.add(txn.receiver_id);
    sender.transactions.push(txn);

    receiver.inDegree++;
    receiver.totalTransactions++;
    receiver.totalAmountReceived += txn.amount;
    receiver.neighbors.add(txn.sender_id);
    receiver.incomingFrom.add(txn.sender_id);
    receiver.transactions.push(txn);

    edges.push({
      source: txn.sender_id,
      target: txn.receiver_id,
      amount: txn.amount,
      timestamp: txn.timestamp,
      transaction_id: txn.transaction_id,
    });

    if (!adjacencyList.has(txn.sender_id)) {
      adjacencyList.set(txn.sender_id, []);
    }
    const neighbors = adjacencyList.get(txn.sender_id)!;
    if (!neighbors.includes(txn.receiver_id)) {
      neighbors.push(txn.receiver_id);
    }
  }

  return { nodes, edges, adjacencyList };
}
