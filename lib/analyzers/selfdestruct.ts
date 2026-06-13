// @ts-nocheck
import * as parser from "@solidity-parser/parser";
import type {
  FunctionCall,
  FunctionDefinition,
  Identifier,
} from "@solidity-parser/parser/dist/src/ast-types";
import type { Vulnerability } from "../types";
import { referencesIdentifier } from "./access-control";
import type { DetectorContext } from "./context";

/**
 * SWC-106: Unprotected SELFDESTRUCT.
 */
export function detectSelfdestruct(ctx: DetectorContext): Vulnerability[] {
  const findings: Vulnerability[] = [];

  parser.visit(ctx.ast, {
    FunctionDefinition(fn: FunctionDefinition) {
      if (!fn.body || !fn.name) return;
      let hit: FunctionCall | null = null;
      parser.visit(fn.body, {
        FunctionCall(call: FunctionCall) {
          if (hit) return;
          if (call.expression.type === "Identifier") {
            const callee: Identifier = call.expression;
            if (callee.name === "selfdestruct" || callee.name === "suicide") {
              hit = call;
            }
          }
        },
      });
      if (!hit) return;
      const guarded = referencesIdentifier(fn.body, "msg", "sender");
      if (guarded) return;
      const loc = ctx.loc(hit);
      findings.push({
        id: "selfdestruct",
        swcId: "SWC-106",
        title: "Unprotected selfdestruct",
        description: `Function '${fn.name}' calls selfdestruct without verifying msg.sender. Anyone can permanently destroy the contract and force-send its balance to an arbitrary address.`,
        severity: "critical",
        remediation:
          "Add an access control modifier (e.g. `onlyOwner`) and consider deprecating selfdestruct entirely. Note that EIP-6780 changes the semantics of SELFDESTRUCT to a regular send on mainnet post-Dencun.",
        reference: "https://swcregistry.io/docs/SWC-106",
        location: { line: loc.line, column: loc.column, functionName: fn.name },
        codeSnippet: ctx.snippet(loc.line),
      });
    },
  });

  return findings;
}
