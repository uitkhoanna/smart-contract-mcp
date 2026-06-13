#!/usr/bin/env node
// Smoke test for the Cysic-backed `evaluate_quality` MCP tool + POST /api/evaluate.
//
// Running this with a real CYSIC_API_KEY set makes a genuine call to the Cysic
// token API (https://token-ai.cysic.xyz/v1) — i.e. it produces *confirmed token
// usage* on the platform. Without a key it should print a clean
// `llm_not_configured` result and exit non-zero, never crash.
//
// Usage: node scripts/smoke-evaluate.mjs [baseUrl] [focus]
//   baseUrl defaults to http://localhost:3000
//   focus   defaults to "overall" (overall|security|gas|style|docs)
import fs from "node:fs";
import path from "node:path";

const baseUrl = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const focus = process.argv[3] || "overall";

const payload = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "scripts/vulnerable-bank-payload.json"), "utf8"),
);

const response = await fetch(`${baseUrl}/api/mcp`, {
  method: "POST",
  headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
  body: JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      name: "evaluate_quality",
      arguments: {
        source_code: payload.source_code,
        contract_name: payload.contract_name,
        focus,
      },
    },
  }),
});

const text = await response.text();
let parsed;
try {
  parsed = JSON.parse(text);
} catch {
  // mcp-handler negotiates to an SSE stream: parse the last `data:` line.
  const dataLine = text
    .split(/\r?\n/)
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trim())
    .pop();
  if (!dataLine) {
    console.error("Non-JSON / non-SSE response:", text.slice(0, 800));
    process.exit(1);
  }
  try {
    parsed = JSON.parse(dataLine);
  } catch {
    console.error("SSE data was not JSON:", dataLine.slice(0, 800));
    process.exit(1);
  }
}

if (!response.ok) {
  console.error("HTTP", response.status, parsed);
  process.exit(1);
}

const toolText = parsed?.result?.content?.[0]?.text;
if (!toolText) {
  console.error("Unexpected response shape:", parsed);
  process.exit(1);
}

let result;
try {
  result = JSON.parse(toolText);
} catch {
  console.error("Tool content was not JSON:", toolText.slice(0, 800));
  process.exit(1);
}

// Configuration-gated path: no key set. Clean, expected, non-zero exit.
if (parsed?.result?.isError) {
  console.error(`[smoke] evaluate_quality returned an error payload: ${result.error}`);
  console.error(`  ${result.message}`);
  if (result.error === "llm_not_configured") {
    console.error(
      "  -> Set CYSIC_API_KEY in .env.local and restart to make a real (token-consuming) call.",
    );
  }
  process.exit(1);
}

// Real LLM path: a structured QualityReport came back — i.e. tokens were spent.
console.log(`[smoke] QualityReport for ${result.contractName} (focus=${focus}):`);
console.log(`  model=${result.model}`);
console.log(`  overallScore=${result.overallScore} grade=${result.grade}`);
console.log(`  dimensions=${result.dimensions?.length ?? 0} issues=${result.issues?.length ?? 0}`);
console.log(`  latencyMs=${result.latencyMs}`);

let ok = true;
if (typeof result.overallScore !== "number") {
  console.error("FAIL: overallScore is not a number");
  ok = false;
} else {
  console.log("PASS: overallScore present");
}
if (!["A", "B", "C", "D", "F"].includes(result.grade)) {
  console.error(`FAIL: grade '${result.grade}' is not A-F`);
  ok = false;
} else {
  console.log("PASS: grade valid");
}
if (result.model !== "minimax-m3") {
  console.warn(`NOTE: model is '${result.model}', expected 'minimax-m3'`);
}

if (!ok) process.exit(1);
console.log("All evaluate smoke checks passed (confirmed token usage produced).");
