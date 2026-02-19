/**
 * Node.js test script for the analysis engine.
 * Mirrors the exact same algorithms as the browser code.
 */
import { readFileSync } from "fs";
import Papa from "papaparse";

const COLUMN_ALIASES = {
  tx_id: "transaction_id", txn_id: "transaction_id", trans_id: "transaction_id",
  transactionid: "transaction_id", transaction_id: "transaction_id", id: "transaction_id",
  sender_account_id: "sender_id", sender: "sender_id", from_id: "sender_id",
  source_id: "sender_id", sender_id: "sender_id", senderid: "sender_id",
  receiver_account_id: "receiver_id", receiver: "receiver_id", to_id: "receiver_id",
  target_id: "receiver_id", receiver_id: "receiver_id", receiverid: "receiver_id",
  tx_amount: "amount", txn_amount: "amount", transaction_amount: "amount",
  value: "amount", amount: "amount",
  timestamp: "timestamp", date: "timestamp", datetime: "timestamp", time: "timestamp",
  tx_date: "timestamp", transaction_date: "timestamp",
};

const REQUIRED = ["transaction_id", "sender_id", "receiver_id", "amount", "timestamp"];

function buildColumnMapping(headers) {
  const mapping = {};
  const mapped = new Set();
  for (const h of headers) {
    const norm = h.toLowerCase().trim();
    const std = COLUMN_ALIASES[norm];
    if (std && !mapped.has(std)) { mapping[h] = std; mapped.add(std); }
  }
  const missing = REQUIRED.filter(c => !mapped.has(c));
  if (missing.length > 0) return null;
  return mapping;
}

function parseCSVString(csvString, fileName) {
  console.log(`\n${"=".repeat(70)}`);
  console.log(`TESTING: ${fileName}`);
  console.log("=".repeat(70));

  const result = Papa.parse(csvString, { header: true, skipEmptyLines: true });
  const headers = result.meta.fields || [];
  console.log(`  Rows: ${result.data.length}, Columns: [${headers.join(", ")}]`);

  const mapping = buildColumnMapping(headers);
  if (!mapping) { console.log(`  FAIL: Could not map columns`); return null; }

  const reverseMap = {};
  for (const [orig, std] of Object.entries(mapping)) reverseMap[std] = orig;
  console.log(`  Column mapping:`, reverseMap);

  const transactions = result.data
    .filter(row => row[reverseMap.transaction_id] && row[reverseMap.sender_id] && row[reverseMap.receiver_id])
    .map(row => {
      const rawTs = String(row[reverseMap.timestamp] || "").trim();
      let timestamp;
      const numTs = Number(rawTs);
      if (!isNaN(numTs) && rawTs.length <= 10 && !rawTs.includes("-")) {
        timestamp = new Date(2025, 0, 1, numTs);
      } else {
        timestamp = new Date(rawTs);
      }
      return {
        transaction_id: String(row[reverseMap.transaction_id]).trim(),
        sender_id: String(row[reverseMap.sender_id]).trim(),
        receiver_id: String(row[reverseMap.receiver_id]).trim(),
        amount: parseFloat(row[reverseMap.amount]),
        timestamp,
      };
    })
    .filter(t => !isNaN(t.amount) && !isNaN(t.timestamp.getTime()));

  console.log(`  Valid transactions: ${transactions.length}`);
  return transactions;
}

// --- Graph Builder ---
function buildGraph(transactions) {
  const nodes = new Map();
  const edges = [];
  const adjacencyList = new Map();

  function getOrCreate(id) {
    if (!nodes.has(id)) {
      nodes.set(id, {
        id, inDegree: 0, outDegree: 0, totalTransactions: 0,
        totalAmountSent: 0, totalAmountReceived: 0,
        neighbors: new Set(), incomingFrom: new Set(), outgoingTo: new Set(),
        transactions: [],
      });
    }
    return nodes.get(id);
  }

  for (const txn of transactions) {
    const sender = getOrCreate(txn.sender_id);
    const receiver = getOrCreate(txn.receiver_id);
    sender.outDegree++; sender.totalTransactions++; sender.totalAmountSent += txn.amount;
    sender.neighbors.add(txn.receiver_id); sender.outgoingTo.add(txn.receiver_id);
    sender.transactions.push(txn);
    receiver.inDegree++; receiver.totalTransactions++; receiver.totalAmountReceived += txn.amount;
    receiver.neighbors.add(txn.sender_id); receiver.incomingFrom.add(txn.sender_id);
    receiver.transactions.push(txn);
    edges.push({ source: txn.sender_id, target: txn.receiver_id, amount: txn.amount, timestamp: txn.timestamp, transaction_id: txn.transaction_id });
    if (!adjacencyList.has(txn.sender_id)) adjacencyList.set(txn.sender_id, []);
    const neighbors = adjacencyList.get(txn.sender_id);
    if (!neighbors.includes(txn.receiver_id)) neighbors.push(txn.receiver_id);
  }
  return { nodes, edges, adjacencyList };
}

// --- Cycle Detector (with amount + temporal validation) ---
const AMOUNT_DECAY_THRESHOLD = 0.5;
const TEMPORAL_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function detectCycles(graph) {
  const rawCycles = [];
  const seen = new Set();
  const allNodes = Array.from(graph.adjacencyList.keys());

  function dfs(current, start, path, visited) {
    const neighbors = graph.adjacencyList.get(current) || [];
    for (const neighbor of neighbors) {
      if (neighbor === start && path.length >= 3 && path.length <= 5) {
        const cyclePath = [...path];
        let minIdx = 0;
        for (let i = 1; i < cyclePath.length; i++) if (cyclePath[i] < cyclePath[minIdx]) minIdx = i;
        const canonical = [...cyclePath.slice(minIdx), ...cyclePath.slice(0, minIdx)].join("->");
        if (!seen.has(canonical)) { seen.add(canonical); rawCycles.push(cyclePath); }
        continue;
      }
      if (!visited.has(neighbor) && path.length < 5) {
        visited.add(neighbor); path.push(neighbor);
        dfs(neighbor, start, path, visited);
        path.pop(); visited.delete(neighbor);
      }
    }
  }

  for (const startNode of allNodes) {
    dfs(startNode, startNode, [startNode], new Set([startNode]));
  }

  console.log(`  Raw structural cycles: ${rawCycles.length}`);

  // Index edges by pair
  const edgesByPair = new Map();
  for (const edge of graph.edges) {
    const key = `${edge.source}->${edge.target}`;
    if (!edgesByPair.has(key)) edgesByPair.set(key, []);
    edgesByPair.get(key).push(edge);
  }

  // Validate
  const validated = [];
  for (const cycle of rawCycles) {
    const hopEdges = [];
    let valid = true;

    for (let i = 0; i < cycle.length; i++) {
      const from = cycle[i];
      const to = cycle[(i + 1) % cycle.length];
      const candidates = edgesByPair.get(`${from}->${to}`);
      if (!candidates || candidates.length === 0) { valid = false; break; }
      hopEdges.push(candidates.reduce((a, b) => a.amount > b.amount ? a : b));
    }

    if (!valid || hopEdges.length !== cycle.length) continue;

    // Amount check
    let amountOk = true;
    for (let i = 1; i < hopEdges.length; i++) {
      if (hopEdges[i - 1].amount > 0 && hopEdges[i].amount / hopEdges[i - 1].amount < AMOUNT_DECAY_THRESHOLD) {
        amountOk = false; break;
      }
    }
    const last = hopEdges[hopEdges.length - 1].amount;
    const first = hopEdges[0].amount;
    if (first > 0 && last / first < AMOUNT_DECAY_THRESHOLD) amountOk = false;
    if (!amountOk) continue;

    // Temporal check
    const times = hopEdges.map(e => e.timestamp.getTime());
    if (Math.max(...times) - Math.min(...times) > TEMPORAL_WINDOW_MS) continue;

    validated.push({ accounts: cycle, length: cycle.length });
  }

  console.log(`  After validation: ${validated.length} suspicious cycles`);
  return validated;
}

// --- Smurfing Detector ---
function detectSmurfing(graph) {
  const patterns = [];
  const FAN_THRESHOLD = 10;

  for (const [nodeId, node] of graph.nodes) {
    if (node.incomingFrom.size >= FAN_THRESHOLD) {
      const sendRatio = node.outDegree / Math.max(node.inDegree, 1);
      if (sendRatio < 0.05) {
        const amounts = node.transactions.filter(t => t.receiver_id === nodeId).map(t => t.amount);
        const mean = amounts.reduce((a,b) => a+b, 0) / amounts.length;
        if (mean > 0) {
          const cv = Math.sqrt(amounts.reduce((s,v) => s + (v-mean)**2, 0) / amounts.length) / mean;
          if (cv < 0.1 && amounts.length > 20) continue;
        }
      }
      patterns.push({ hub_account: nodeId, type: "fan_in", connected_accounts: Array.from(node.incomingFrom), temporal_window_hours: -1 });
    }
    if (node.outgoingTo.size >= FAN_THRESHOLD) {
      const receiveRatio = node.inDegree / Math.max(node.outDegree, 1);
      if (receiveRatio < 0.05) {
        const amounts = node.transactions.filter(t => t.sender_id === nodeId).map(t => t.amount);
        const mean = amounts.reduce((a,b) => a+b, 0) / amounts.length;
        if (mean > 0) {
          const cv = Math.sqrt(amounts.reduce((s,v) => s + (v-mean)**2, 0) / amounts.length) / mean;
          if (cv < 0.1 && amounts.length > 20) continue;
        }
      }
      patterns.push({ hub_account: nodeId, type: "fan_out", connected_accounts: Array.from(node.outgoingTo), temporal_window_hours: -1 });
    }
  }
  return patterns;
}

// --- Shell Detector ---
function detectShellNetworks(graph) {
  const chains = [];
  const seen = new Set();
  const SHELL_MAX = 3;

  function findChains(current, path, visited) {
    if (path.length > 8) return;
    const neighbors = graph.adjacencyList.get(current) || [];
    for (const neighbor of neighbors) {
      if (visited.has(neighbor)) continue;
      const nNode = graph.nodes.get(neighbor);
      const isShell = nNode.totalTransactions <= SHELL_MAX;
      path.push(neighbor); visited.add(neighbor);
      if (isShell) { findChains(neighbor, path, visited); }
      else {
        const intermediaries = path.slice(1, -1);
        const shells = intermediaries.filter(id => graph.nodes.get(id).totalTransactions <= SHELL_MAX);
        if (path.length >= 5 && shells.length >= 3) {
          const key = path.join("->");
          if (!seen.has(key)) { seen.add(key); chains.push({ chain: [...path], shell_accounts: shells }); }
        }
      }
      path.pop(); visited.delete(neighbor);
    }
  }

  for (const [nodeId] of graph.adjacencyList) {
    const node = graph.nodes.get(nodeId);
    if (node.totalTransactions <= SHELL_MAX) continue;
    findChains(nodeId, [nodeId], new Set([nodeId]));
  }
  return chains;
}

// --- Run Tests ---
const files = [
  { path: "/Users/gowrizz/Downloads/sample_money_muling_dataset.csv", name: "sample_money_muling_dataset.csv (29 rows - has known patterns)" },
  { path: "/Users/gowrizz/Downloads/clean_1000_transactions.csv", name: "clean_1000_transactions.csv (1000 rows - should have few/no cycles)" },
  { path: "/Users/gowrizz/Downloads/transactions.csv", name: "transactions.csv (1.3M rows - capped to 50K)" },
];

for (const f of files) {
  const startTime = performance.now();
  const csv = readFileSync(f.path, "utf-8");
  let transactions = parseCSVString(csv, f.name);
  if (!transactions) continue;

  if (transactions.length > 50000) {
    console.log(`  [NOTE] Capping at 50,000 rows for test (original: ${transactions.length})`);
    transactions = transactions.slice(0, 50000);
  }

  console.log(`\n  Building graph...`);
  const graph = buildGraph(transactions);
  console.log(`  Graph: ${graph.nodes.size} nodes, ${graph.edges.length} edges`);

  console.log(`  Detecting cycles (with amount+temporal validation)...`);
  const t1 = performance.now();
  const cycles = detectCycles(graph);
  console.log(`  Cycles: ${cycles.length} (${((performance.now() - t1)/1000).toFixed(2)}s)`);
  cycles.slice(0, 10).forEach(c => console.log(`    [${c.accounts.join(" -> ")}] (len ${c.length})`));

  console.log(`  Detecting smurfing...`);
  const t2 = performance.now();
  const smurfing = detectSmurfing(graph);
  console.log(`  Smurfing: ${smurfing.length} (${((performance.now() - t2)/1000).toFixed(2)}s)`);
  smurfing.slice(0, 10).forEach(p => console.log(`    ${p.type} hub=${p.hub_account} connections=${p.connected_accounts.length}`));

  console.log(`  Detecting shell networks...`);
  const t3 = performance.now();
  const shells = detectShellNetworks(graph);
  console.log(`  Shell chains: ${shells.length} (${((performance.now() - t3)/1000).toFixed(2)}s)`);

  const totalTime = ((performance.now() - startTime) / 1000).toFixed(2);
  console.log(`\n  === SUMMARY ===`);
  console.log(`  Time: ${totalTime}s | Cycles: ${cycles.length} | Smurfing: ${smurfing.length} | Shells: ${shells.length}`);
}
