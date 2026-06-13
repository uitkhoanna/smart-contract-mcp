#!/usr/bin/env node
// Validate the four MCP tool input schemas with zod.
// Mirrors the schemas declared in app/api/mcp/route.ts.
import { z } from "zod";

const VULN_TYPES = [
  "reentrancy",
  "access_control",
  "integer_overflow",
  "unchecked_calls",
  "timestamp_dependence",
  "tx_origin",
  "selfdestruct",
];

const AnalyzeContractArgs = z.object({
  source_code: z.string().min(1),
  contract_name: z.string().min(1).optional(),
});

const CheckVulnerabilityArgs = z.object({
  source_code: z.string().min(1),
  vulnerability_type: z.enum(VULN_TYPES),
});

const GenerateAuditReportArgs = z.object({
  source_code: z.string().min(1),
  contract_name: z.string().min(1),
  auditor_name: z.string().min(1).optional(),
});

const SuggestFixArgs = z.object({
  source_code: z.string().min(1),
  vulnerability_id: z.string().min(1),
  vulnerability_name: z.string().min(1),
});

const CASES = [
  ["analyze_contract", AnalyzeContractArgs, { source_code: "pragma solidity ^0.8.0; contract C {}" }],
  ["analyze_contract (named)", AnalyzeContractArgs, { source_code: "pragma solidity ^0.8.0; contract C {}", contract_name: "C" }],
  ["check_vulnerability", CheckVulnerabilityArgs, { source_code: "x", vulnerability_type: "reentrancy" }],
  ["check_vulnerability (every enum)", CheckVulnerabilityArgs, { source_code: "x", vulnerability_type: "selfdestruct" }],
  ["generate_audit_report", GenerateAuditReportArgs, { source_code: "x", contract_name: "C" }],
  ["suggest_fix", SuggestFixArgs, { source_code: "x", vulnerability_id: "reentrancy", vulnerability_name: "Reentrancy" }],
];

let ok = true;
for (const [name, schema, sample] of CASES) {
  try {
    schema.parse(sample);
    console.log(`PASS: ${name}`);
  } catch (err) {
    ok = false;
    console.error(`FAIL: ${name}`, err.message ?? err);
  }
}

if (!ok) process.exit(1);
console.log("All schema validations passed.");
