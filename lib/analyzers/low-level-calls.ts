// @ts-nocheck
import * as parser from "@solidity-parser/parser";
import type { FunctionCall, MemberAccess } from "@solidity-parser/parser/dist/src/ast-types";
import type { Vulnerability } from "../types";
import type { DetectorContext } from "./context";

/**
 * SWC-104: Unchecked Low-Level Calls.
 *
 * Flags `.call`, `.delegatecall`, `.staticcall`, `.send` whose return value
 * is not wrapped in `require(...)` (heuristic: we conservatively emit
 * `medium` findings for any low-level call; the `require(success)` wrap is
 * a structural check we relax to avoid false negatives).
 */
export function detectUncheckedCalls(ctx: DetectorContext): Vulnerability[] {
  const findings: Vulnerability[] = [];

  parser.visit(ctx.ast, {
    FunctionCall(call: FunctionCall) {
      const expr = call.expression;
      if (expr.type !== "MemberAccess") return;
      const member = expr.memberName;
      if (!["call", "delegatecall", "staticcall", "send"].includes(member)) return;
      if (member === "transfer") return;

      const loc = ctx.loc(call);
      findings.push({
        id: "unchecked_calls",
        swcId: "SWC-104",
        title: "Unchecked low-level call",
        description: `The return value of a low-level ${member} call is ignored. If the call fails, execution will continue as if it succeeded.`,
        severity: "medium",
        remediation:
          "Wrap the call in `require(success, ...)` or use OpenZeppelin's `Address.functionCall` which reverts on failure.",
        reference: "https://swcregistry.io/docs/SWC-104",
        location: { line: loc.line, column: loc.column, functionName: ctx.currentFunction },
        codeSnippet: ctx.snippet(loc.line),
      });
    },
  });

  return findings;
}

export type { MemberAccess };
