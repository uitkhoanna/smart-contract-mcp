// @ts-nocheck
import * as parser from "@solidity-parser/parser";
import type { BinaryOperation, Block, FunctionDefinition } from "@solidity-parser/parser/dist/src/ast-types";
import type { Vulnerability } from "../types";
import type { DetectorContext } from "./context";

/**
 * SWC-105: Unprotected Ether Withdrawal (access control).
 *
 * Flags any public/external function that mutates state but never references
 * `msg.sender` (and is not the constructor).
 */
export function detectAccessControl(ctx: DetectorContext): Vulnerability[] {
  const findings: Vulnerability[] = [];

  parser.visit(ctx.ast, {
    FunctionDefinition(fn: FunctionDefinition) {
      if (!fn.body || !fn.name) return;
      if (fn.isConstructor) return;
      if (fn.stateMutability === "view" || fn.stateMutability === "pure") return;
      if (fn.visibility !== "public" && fn.visibility !== "external") return;

      const writes = hasStateWrite(fn.body);
      if (!writes) return;
      const usesSender = referencesIdentifier(fn.body, "msg", "sender");
      if (usesSender) return;

      const loc = ctx.loc(fn);
      findings.push({
        id: "access_control",
        swcId: "SWC-105",
        title: "Unprotected state-mutating function",
        description: `Function '${fn.name}' is ${fn.visibility} and writes to contract state but does not reference msg.sender. Anyone can call it.`,
        severity: "high",
        remediation:
          "Add an access-control modifier (e.g. OpenZeppelin's `onlyOwner`) or a `require(msg.sender == owner)` guard, or make the function `internal`/`private` if it should not be callable externally.",
        reference: "https://swcregistry.io/docs/SWC-105",
        location: { line: loc.line, column: loc.column, functionName: fn.name },
        codeSnippet: ctx.snippet(loc.line),
      });
    },
  });

  return findings;
}

function hasStateWrite(node: Block | FunctionDefinition): boolean {
  let found = false;
  parser.visit(node, {
    BinaryOperation(bin: BinaryOperation) {
      if (found) return;
      if (["=", "+=", "-=", "*=", "/=", "%=", "<<=", ">>=", "&=", "|=", "^="].includes(bin.operator)) {
        if (bin.left.type === "MemberAccess") {
          found = true;
        }
      }
    },
  });
  return found;
}

export function referencesIdentifier(
  node: Block | FunctionDefinition,
  parent: string,
  child: string,
): boolean {
  let found = false;
  parser.visit(node, {
    MemberAccess(m) {
      if (found) return;
      if (m.memberName === child && m.expression.type === "Identifier" && m.expression.name === parent) {
        found = true;
      }
    },
  });
  return found;
}
