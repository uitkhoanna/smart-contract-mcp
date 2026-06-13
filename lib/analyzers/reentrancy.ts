// @ts-nocheck
import * as parser from "@solidity-parser/parser";
import type {
  BaseASTNode,
  BinaryOperation,
  Block,
  FunctionCall,
  FunctionDefinition,
  MemberAccess,
} from "@solidity-parser/parser/dist/src/ast-types";
import type { Vulnerability } from "../types";
import type { DetectorContext } from "./context";

/**
 * SWC-107: Reentrancy.
 *
 * Within any function, look for an external call (`addr.call(...)`,
 * `transfer`, or `send`) BEFORE a state write (any assignment to a
 * member). Classic Checks-Effects-Interactions violation.
 */
export function detectReentrancy(ctx: DetectorContext): Vulnerability[] {
  const findings: Vulnerability[] = [];

  parser.visit(ctx.ast, {
    FunctionDefinition(fn: FunctionDefinition) {
      if (!fn.body || !fn.name) return;
      const statements = fn.body.statements;
      let firstCall: FunctionCall | null = null;
      let lateWrite: BinaryOperation | null = null;
      for (const stmt of statements) {
        if (!firstCall) {
          firstCall = findExternalCall(stmt);
          continue;
        }
        const writeHit = findStateWrite(stmt);
        if (writeHit) {
          lateWrite = writeHit;
          break;
        }
      }
      if (firstCall && lateWrite) {
        const loc = ctx.loc(firstCall);
        findings.push({
          id: "reentrancy",
          swcId: "SWC-107",
          title: "Reentrancy",
          description: `Function '${fn.name}' performs an external call before updating contract state. An attacker can re-enter the function and observe inconsistent balances.`,
          severity: "critical",
          remediation:
            "Apply the Checks-Effects-Interactions pattern: complete all state updates BEFORE making external calls, or use a reentrancy guard (e.g. OpenZeppelin's ReentrancyGuard).",
          reference: "https://swcregistry.io/docs/SWC-107",
          location: { line: loc.line, column: loc.column, functionName: fn.name },
          codeSnippet: ctx.snippet(loc.line),
        });
      }
    },
  });

  return findings;
}

function findExternalCall(stmt: BaseASTNode): FunctionCall | null {
  let result: FunctionCall | null = null;
  parser.visit(stmt, {
    FunctionCall(call: FunctionCall) {
      if (result) return;
      const expr = call.expression;
      if (expr.type !== "MemberAccess") return;
      const member = expr.memberName;
      if (
        member === "call" ||
        member === "delegatecall" ||
        member === "staticcall" ||
        member === "transfer" ||
        member === "send"
      ) {
        result = call;
      }
    },
  });
  return result;
}

function findStateWrite(stmt: BaseASTNode): BinaryOperation | null {
  let result: BinaryOperation | null = null;
  parser.visit(stmt, {
    BinaryOperation(bin: BinaryOperation) {
      if (result) return;
      if (!["=", "+=", "-=", "*=", "/=", "%="].includes(bin.operator)) return;
      // Treat any assignment to a member/indexed expression as a state write.
      // e.g. `balances[msg.sender] -= amount` left is IndexAccess; that is a
      // mapping write which is what reentrancy cares about.
      if (bin.left.type === "MemberAccess" || bin.left.type === "IndexAccess") {
        result = bin;
      }
    },
  });
  return result;
}

// Suppress unused import warnings for MemberAccess / Block if a future change uses them.
export type { MemberAccess, Block };
