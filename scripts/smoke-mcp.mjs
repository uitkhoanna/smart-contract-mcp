#!/usr/bin/env node
// Smoke test for the MCP server's analyze_contract tool.
// Usage: node scripts/smoke-mcp.mjs [baseUrl]
import fs from "node:fs";
import path from "node:path";

const baseUrl = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");

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
      name: "analyze_contract",
      arguments: {
        source_code: payload.source_code,
        contract_name: payload.contract_name,
      },
    },
  }),
});

const text = await response.text();
let parsed;
try {
  parsed = JSON.parse(text);
} catch {
  console.error("Non-JSON response:", text.slice(0, 800));
  process.exit(1);
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

const result = JSON.parse(toolText);
const vulns = Array.isArray(result.vulnerabilities) ? result.vulnerabilities : [];
const critCount = vulns.filter((v) => v.severity === "critical").length;

console.log(`[smoke] tool result for ${result.contractName}:`);
console.log(`  riskScore=${result.riskScore}, riskLevel=${result.riskLevel}`);
console.log(`  vulnerabilities=${vulns.length}, critical=${critCount}`);

let ok = true;
if (vulns.length < 3) {
  console.error(`FAIL: expected >= 3 vulnerabilities, got ${vulns.length}`);
  ok = false;
} else {
  console.log("PASS: >= 3 vulnerabilities");
}
if (critCount < 1) {
  console.error("FAIL: expected at least one critical finding");
  ok = false;
} else {
  console.log("PASS: has critical");
}

if (!ok) process.exit(1);
console.log("All smoke checks passed.");
