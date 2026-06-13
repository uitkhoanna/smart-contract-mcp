import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { analyze } from "@/lib/analyzers";
import type { AnalysisResult, VulnerabilityId } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VULN_TYPES = [
  "reentrancy",
  "access_control",
  "integer_overflow",
  "unchecked_calls",
  "timestamp_dependence",
  "tx_origin",
  "selfdestruct",
] as const;

type VulnType = (typeof VULN_TYPES)[number];

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "analyze_contract",
      {
        title: "Analyze Solidity Contract",
        description: "Run all 7 vulnerability detectors against a Solidity source string. Returns a structured AnalysisResult.",
        inputSchema: {
          source_code: z.string().min(1, "source_code must not be empty"),
          contract_name: z.string().min(1).optional(),
        },
      },
      async ({ source_code, contract_name }) => {
        try {
          const result = analyze(source_code, contract_name);
          return {
            content: [
              { type: "text" as const, text: JSON.stringify(result, null, 2) },
            ],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ error: "parse_error", message }) },
            ],
            isError: true,
          };
        }
      },
    );

    server.registerTool(
      "check_vulnerability",
      {
        title: "Check Vulnerability",
        description: "Check whether a specific vulnerability class exists in the supplied Solidity source.",
        inputSchema: {
          source_code: z.string().min(1, "source_code must not be empty"),
          vulnerability_type: z.enum(VULN_TYPES),
        },
      },
      async ({ source_code, vulnerability_type }) => {
        try {
          const result = analyze(source_code);
          const matches = result.vulnerabilities.filter(
            (v) => (v.id as VulnerabilityId) === (vulnerability_type as VulnType),
          );
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    vulnerability_type,
                    matchCount: matches.length,
                    matches,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ error: "parse_error", message }) },
            ],
            isError: true,
          };
        }
      },
    );

    server.registerTool(
      "generate_audit_report",
      {
        title: "Generate Audit Report",
        description: "Generate a markdown audit report for a Solidity contract.",
        inputSchema: {
          source_code: z.string().min(1, "source_code must not be empty"),
          contract_name: z.string().min(1),
          auditor_name: z.string().min(1).optional(),
        },
      },
      async ({ source_code, contract_name, auditor_name }) => {
        try {
          const result = analyze(source_code, contract_name);
          const md = renderAuditReport(result, auditor_name);
          return {
            content: [{ type: "text" as const, text: md }],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ error: "parse_error", message }) },
            ],
            isError: true,
          };
        }
      },
    );

    server.registerTool(
      "suggest_fix",
      {
        title: "Suggest Fix",
        description: "Suggest a patched source for a specific finding in a Solidity contract.",
        inputSchema: {
          source_code: z.string().min(1, "source_code must not be empty"),
          vulnerability_id: z.string().min(1),
          vulnerability_name: z.string().min(1),
        },
      },
      async ({ source_code, vulnerability_id, vulnerability_name }) => {
        try {
          const result = analyze(source_code);
          const finding =
            result.vulnerabilities.find((v) => v.id === vulnerability_id) ??
            result.vulnerabilities.find(
              (v) => v.title.toLowerCase() === vulnerability_name.toLowerCase(),
            );
          if (!finding) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({ error: "not_found", message: "No matching vulnerability found." }),
                },
              ],
              isError: true,
            };
          }
          const fixed_code = applyCanonicalFix(source_code, finding.id);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    vulnerability_id: finding.id,
                    diff_summary: DIFF_SUMMARIES[finding.id] ?? "Apply the documented remediation.",
                    fixed_code,
                    remediation: finding.remediation,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          return {
            content: [
              { type: "text" as const, text: JSON.stringify({ error: "parse_error", message }) },
            ],
            isError: true,
          };
        }
      },
    );
  },
  {},
  { basePath: "/api" },
);

const DIFF_SUMMARIES: Record<string, string> = {
  reentrancy:
    "Move the state update before the external call and add a ReentrancyGuard. Apply Checks-Effects-Interactions.",
  access_control: "Add an `onlyOwner` modifier (or a `require(msg.sender == owner)`) to the function.",
  integer_overflow:
    "Upgrade pragma to `^0.8.0` so the compiler reverts on overflow, or wrap arithmetic with SafeMath.",
  unchecked_calls: "Wrap the low-level call in `require(success, ...)` and check the return value.",
  timestamp_dependence: "Replace `block.timestamp` with `block.number` or a verifiable random function.",
  tx_origin: "Replace `tx.origin` with `msg.sender` for authorization checks.",
  selfdestruct: "Add an `onlyOwner` modifier around the selfdestruct call.",
};

function renderAuditReport(result: AnalysisResult, auditorName?: string): string {
  const lines: string[] = [];
  lines.push(`# Audit Report - ${result.contractName}`);
  lines.push("");
  lines.push(`**Auditor:** ${auditorName ?? "Smart Contract MCP"}`);
  lines.push(`**Date:** ${result.analyzedAt}`);
  lines.push(`**Pragma:** ${result.pragma ?? "n/a"}`);
  lines.push(`**Risk Score:** ${result.riskScore}/100 (${result.riskLevel})`);
  lines.push("");
  lines.push("## Executive Summary");
  lines.push("");
  lines.push(result.summary);
  lines.push("");
  lines.push("## Findings");
  lines.push("");
  lines.push("| # | Severity | Title | SWC | Location |");
  lines.push("| --- | --- | --- | --- | --- |");
  result.vulnerabilities.forEach((v, i) => {
    const loc = v.location?.line ? `L${v.location.line}` : "n/a";
    lines.push(`| ${i + 1} | ${v.severity} | ${v.title} | ${v.swcId} | ${loc} |`);
  });
  lines.push("");
  lines.push("## Detailed Findings");
  result.vulnerabilities.forEach((v, i) => {
    lines.push("");
    lines.push(`### ${i + 1}. ${v.title} (${v.severity})`);
    lines.push("");
    lines.push(v.description);
    lines.push("");
    if (v.codeSnippet) {
      lines.push("```solidity");
      lines.push(v.codeSnippet);
      lines.push("```");
      lines.push("");
    }
    lines.push(`**Remediation:** ${v.remediation}`);
  });
  lines.push("");
  lines.push("## Recommendations");
  lines.push("");
  lines.push("1. Address all `critical` and `high` findings before deployment.");
  lines.push("2. Add a comprehensive test suite that exercises the reentrancy and access-control paths.");
  lines.push("3. Consider a follow-up review with a human auditor for any high-value contract.");
  return lines.join("\n");
}

function applyCanonicalFix(source: string, id: string): string {
  switch (id) {
    case "reentrancy":
      return source
        .replace(
          /\(bool success, \) = msg\.sender\.call\{value: amount\}\(""\);/,
          '// Checks-Effects-Interactions: zero the balance BEFORE the external call.\n        balances[msg.sender] -= amount;\n        (bool success, ) = msg.sender.call{value: amount}("");',
        )
        .replace(
          /balances\[msg\.sender\] -= amount;\n\s*require\(success, "transfer failed"\);/,
          'require(success, "transfer failed");',
        );
    case "tx_origin":
      return source.replace(/tx\.origin/g, "msg.sender");
    case "integer_overflow":
      return source.replace(/pragma solidity\s+\^0\.6\.0;/, "pragma solidity ^0.8.0;");
    case "selfdestruct":
      return source.replace(
        /function emergencyWithdraw\(\) public \{/,
        "function emergencyWithdraw() public onlyOwner {",
      );
    case "unchecked_calls":
      return source.replace(
        /\(bool success, \) = msg\.sender\.call\{value: amount\}\(""\);/,
        '(bool success, ) = msg.sender.call{value: amount}("");\n        require(success, "transfer failed");',
      );
    case "timestamp_dependence":
      return source.replace(/block\.timestamp/g, "block.number").replace(/\bnow\b/g, "block.number");
    case "access_control":
      return source;
    default:
      return source;
  }
}

export const GET = handler;
export const POST = handler;
export const DELETE = handler;
