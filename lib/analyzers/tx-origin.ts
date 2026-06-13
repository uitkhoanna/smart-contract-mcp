// @ts-nocheck
import * as parser from "@solidity-parser/parser";
import type { MemberAccess } from "@solidity-parser/parser/dist/src/ast-types";
import type { Vulnerability } from "../types";
import type { DetectorContext } from "./context";

/**
 * SWC-115: Authorization through tx.origin.
 */
export function detectTxOrigin(ctx: DetectorContext): Vulnerability[] {
  const findings: Vulnerability[] = [];

  parser.visit(ctx.ast, {
    MemberAccess(m: MemberAccess) {
      if (m.expression.type !== "Identifier") return;
      if (m.expression.name !== "tx" || m.memberName !== "origin") return;
      const loc = ctx.loc(m);
      findings.push({
        id: "tx_origin",
        swcId: "SWC-115",
        title: "tx.origin used for authorization",
        description:
          "Using `tx.origin` as an authentication mechanism is vulnerable to phishing. Any contract the user has approved can drain funds through the authorized function.",
        severity: "high",
        remediation:
          "Replace `tx.origin` with `msg.sender` for authorization. `msg.sender` is the immediate caller and cannot be spoofed by intermediate contracts.",
        reference: "https://swcregistry.io/docs/SWC-115",
        location: { line: loc.line, column: loc.column, functionName: ctx.currentFunction },
        codeSnippet: ctx.snippet(loc.line),
      });
    },
  });

  return findings;
}
