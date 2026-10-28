// Payment reconciliation.
//
// Reads payments.jsonl and works out how much money we actually collected.
// Run:  node reconcile.js

const fs = require("fs");

// Amounts arrive either as numbers or as strings with thousands separators
// (e.g. "4,804.15"), so normalise before using them.
function parseAmount(value) {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return NaN;
  const cleaned = value.replace(/[^0-9.-]/g, "");
  return cleaned === "" ? NaN : Number(cleaned);
}

// A payment can be attempted more than once with the same txn_id; only the
// latest attempt counts, so keep the newest event per id.
const latest = new Map();

const lines = fs.readFileSync("payments.jsonl", "utf8").split(/\r?\n/);
for (const line of lines) {
  const trimmed = line.trim();
  if (trimmed === "") continue;

  let event;
  try {
    event = JSON.parse(trimmed);
  } catch {
    continue; // unreadable line in the export
  }
  if (event === null || typeof event !== "object") continue;

  const txnId = event.txn_id;
  if (txnId === undefined || txnId === null || String(txnId).trim() === "") {
    continue; // no txn_id, so no way to tell which attempt it belongs to
  }

  const amount = parseAmount(event.amount);
  if (!Number.isFinite(amount)) continue;

  const ts = Date.parse(event.ts);
  const previous = latest.get(txnId);
  if (!previous || (Number.isFinite(ts) ? ts >= previous.ts : true)) {
    latest.set(txnId, { ts: Number.isFinite(ts) ? ts : -Infinity, amount, status: event.status });
  }
}

let total = 0;
let count = 0;
for (const attempt of latest.values()) {
  if (attempt.status === "success") {
    total += attempt.amount;
    count += 1;
  }
}

const expected = parseInt(fs.readFileSync("expected.txt", "utf8").trim(), 10);

if (count !== expected) {
  console.log(`Check failed: counted ${count} successful payments, expected ${expected}.`);
  console.log("Something in the data isn't being handled the way the README describes.");
} else {
  console.log(`Check passed: ${count} successful payments.`);
  console.log(`Your code: KOYA-${Math.round(total)}`);
}
