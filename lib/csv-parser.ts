import Papa from "papaparse";
import { Transaction } from "./types";

const REQUIRED_COLUMNS = [
  "transaction_id",
  "sender_id",
  "receiver_id",
  "amount",
  "timestamp",
];

const COLUMN_ALIASES: Record<string, string> = {
  tx_id: "transaction_id",
  txn_id: "transaction_id",
  trans_id: "transaction_id",
  transactionid: "transaction_id",
  transaction_id: "transaction_id",
  id: "transaction_id",

  sender_account_id: "sender_id",
  sender: "sender_id",
  from_id: "sender_id",
  from_account: "sender_id",
  source_id: "sender_id",
  source: "sender_id",
  sender_id: "sender_id",
  senderid: "sender_id",

  receiver_account_id: "receiver_id",
  receiver: "receiver_id",
  to_id: "receiver_id",
  to_account: "receiver_id",
  target_id: "receiver_id",
  destination_id: "receiver_id",
  receiver_id: "receiver_id",
  receiverid: "receiver_id",

  tx_amount: "amount",
  txn_amount: "amount",
  transaction_amount: "amount",
  value: "amount",
  amount: "amount",

  timestamp: "timestamp",
  date: "timestamp",
  datetime: "timestamp",
  time: "timestamp",
  tx_date: "timestamp",
  transaction_date: "timestamp",
};

function buildColumnMapping(
  headers: string[]
): Record<string, string> | null {
  const mapping: Record<string, string> = {};
  const mapped = new Set<string>();

  for (const header of headers) {
    const normalized = header.toLowerCase().trim();
    const standardName = COLUMN_ALIASES[normalized];

    if (standardName && !mapped.has(standardName)) {
      mapping[header] = standardName;
      mapped.add(standardName);
    }
  }

  const missing = REQUIRED_COLUMNS.filter((col) => !mapped.has(col));
  if (missing.length > 0) {
    console.warn(
      `[CSV Parser] Could not auto-map columns: ${missing.join(", ")}. Mapped so far:`,
      mapping
    );
    return null;
  }

  return mapping;
}

export function parseCSV(file: File): Promise<Transaction[]> {
  console.log(
    `[CSV Parser] Starting parse of file: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`
  );

  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, any>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const headers = results.meta.fields || [];
        console.log(
          `[CSV Parser] Papa Parse complete. Rows: ${results.data.length}, Fields: [${headers.join(", ")}]`
        );

        if (results.errors.length > 0) {
          console.warn(
            `[CSV Parser] Parse warnings:`,
            results.errors.slice(0, 5)
          );
        }

        const columnMapping = buildColumnMapping(headers);

        if (!columnMapping) {
          const err = `Could not map CSV columns to required format. Found columns: [${headers.join(", ")}]. Required: [${REQUIRED_COLUMNS.join(", ")}]`;
          console.error(`[CSV Parser] ${err}`);
          reject(new Error(err));
          return;
        }

        const reverseMap: Record<string, string> = {};
        for (const [original, standard] of Object.entries(columnMapping)) {
          reverseMap[standard] = original;
        }

        console.log(`[CSV Parser] Column mapping:`, reverseMap);

        try {
          const transactions: Transaction[] = results.data
            .filter((row) => {
              const txnId = row[reverseMap["transaction_id"]];
              const senderId = row[reverseMap["sender_id"]];
              const receiverId = row[reverseMap["receiver_id"]];
              return txnId && senderId && receiverId;
            })
            .map((row) => {
              const rawTimestamp = String(
                row[reverseMap["timestamp"]] || ""
              ).trim();

              let timestamp: Date;
              const numericTs = Number(rawTimestamp);
              if (!isNaN(numericTs) && rawTimestamp.length <= 10 && !rawTimestamp.includes("-")) {
                timestamp = new Date(2025, 0, 1, numericTs);
              } else {
                timestamp = new Date(rawTimestamp);
              }

              return {
                transaction_id: String(
                  row[reverseMap["transaction_id"]]
                ).trim(),
                sender_id: String(row[reverseMap["sender_id"]]).trim(),
                receiver_id: String(row[reverseMap["receiver_id"]]).trim(),
                amount: parseFloat(row[reverseMap["amount"]]),
                timestamp,
              };
            });

          const invalid = transactions.filter(
            (t) => isNaN(t.amount) || isNaN(t.timestamp.getTime())
          );
          if (invalid.length > 0) {
            console.warn(
              `[CSV Parser] Skipping ${invalid.length} rows with invalid data. First invalid:`,
              invalid.slice(0, 3)
            );
          }

          const valid = transactions.filter(
            (t) => !isNaN(t.amount) && !isNaN(t.timestamp.getTime())
          );

          console.log(
            `[CSV Parser] Successfully parsed ${valid.length} valid transactions (${invalid.length} invalid skipped)`
          );

          if (valid.length > 0) {
            console.log(`[CSV Parser] Sample row:`, {
              transaction_id: valid[0].transaction_id,
              sender_id: valid[0].sender_id,
              receiver_id: valid[0].receiver_id,
              amount: valid[0].amount,
              timestamp: valid[0].timestamp.toISOString(),
            });
          }

          resolve(valid);
        } catch (err) {
          console.error(`[CSV Parser] Failed to parse CSV data:`, err);
          reject(new Error(`Failed to parse CSV data: ${err}`));
        }
      },
      error: (error: Error) => {
        console.error(`[CSV Parser] Papa Parse error:`, error);
        reject(new Error(`CSV parsing error: ${error.message}`));
      },
    });
  });
}
