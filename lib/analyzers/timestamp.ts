// @ts-nocheck
import * as parser from "@solidity-parser/parser";
import type { MemberAccess } from "@solidity-parser/parser/dist/src/ast-types";
import type { Vulnerability } from "../types";
import type { DetectorContext } from "./context";

/**
 * SWC-116: Block values as a proxy for time.
 *
 * Flags any `block.timestamp` (or legacy `now`) reference inside a
 * function. Without a parent map we cannot inspect the enclosing operator,
 * so we conservatively flag every occurrence.
 */
export function detectTimestampDependence(ctx: DetectorContext): Vulnerability[] {
  const findings: Vulnerability[] = [];

  parser.visit(ctx.ast, {
    MemberAccess(m: MemberAccess) {
      if (m.expression.type !== "Identifier") return;
      const name = m.expression.name;
      const member = m.memberName;
      if (!(name === "block" && member === "timestamp") && !(name === "now")) return;
      const loc = ctx.loc(m);
      findings.push({
        id: "timestamp_dependence",
        swcId: "SWC-116",
        title: "Timestamp dependence",
        description:
          "block.timestamp is used in contract logic. Miners can influence the timestamp by a few seconds, which can break strict comparisons, randomness, or time-locks.",
        severity: "low",
        remediation:
          "Avoid using `block.timestamp` for strict equality, randomness, or tight time windows. Use `block.number` for sequencing, or a commit-reveal scheme (or Chainlink VRF) for randomness.",
        reference: "https://swcregistry.io/docs/SWC-116",
        location: { line: loc.line, column: loc.column, functionName: ctx.currentFunction },
        codeSnippet: ctx.snippet(loc.line),
      });
    },
  });

  return findings;
}
