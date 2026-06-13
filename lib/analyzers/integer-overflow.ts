// @ts-nocheck
import * as parser from "@solidity-parser/parser";
import type {
  BinaryOperation,
  Block,
  FunctionDefinition,
  UncheckedStatement,
} from "@solidity-parser/parser/dist/src/ast-types";
import type { Vulnerability } from "../types";
import type { DetectorContext } from "./context";

/**
 * SWC-101: Integer Overflow and Underflow.
 *
 * For Solidity < 0.8.0 (or contracts without a pragma), any arithmetic
 * operation on `uint` / `int` typed values is flagged. For >= 0.8.0, only
 * arithmetic inside an `unchecked {}` block is flagged.
 */
export function detectIntegerOverflow(ctx: DetectorContext): Vulnerability[] {
  const findings: Vulnerability[] = [];
  const pre080 = !ctx.pragma || ctx.pragma.pre080;

  parser.visit(ctx.ast, {
    FunctionDefinition(fn: FunctionDefinition) {
      if (!fn.body || !fn.name) return;
      if (pre080) {
        const hit = findArithmetic(fn.body);
        if (hit) {
          const loc = ctx.loc(hit);
          findings.push({
            id: "integer_overflow",
            swcId: "SWC-101",
            title: "Integer overflow / underflow",
            description: `Function '${fn.name}' performs arithmetic on integer types in a pre-0.8.0 contract (pragma ${ctx.pragma?.raw ?? "absent"}). Solidity < 0.8.0 silently wraps on overflow.`,
            severity: "high",
            remediation:
              "Upgrade to Solidity 0.8.x (default overflow checks) or wrap arithmetic with OpenZeppelin's SafeMath library.",
            reference: "https://swcregistry.io/docs/SWC-101",
            location: { line: loc.line, column: loc.column, functionName: fn.name },
            codeSnippet: ctx.snippet(loc.line),
          });
        }
        return;
      }
      parser.visit(fn.body, {
        UncheckedStatement(blk: UncheckedStatement) {
          const hit = findArithmetic(blk);
          if (hit) {
            const loc = ctx.loc(hit);
            findings.push({
              id: "integer_overflow",
              swcId: "SWC-101",
              title: "Integer overflow in unchecked block",
              description: `Function '${fn.name}' contains arithmetic inside an 'unchecked' block. Solidity skips overflow checks inside 'unchecked'`,
              severity: "high",
              remediation:
                "Remove the 'unchecked' block, or add explicit SafeMath-style bounds checks before each arithmetic operation.",
              reference: "https://swcregistry.io/docs/SWC-101",
              location: { line: loc.line, column: loc.column, functionName: fn.name },
              codeSnippet: ctx.snippet(loc.line),
            });
          }
        },
      });
    },
  });

  return findings;
}

function findArithmetic(node: Block | FunctionDefinition | UncheckedStatement): BinaryOperation | null {
  let result: BinaryOperation | null = null;
  parser.visit(node, {
    BinaryOperation(bin: BinaryOperation) {
      if (result) return;
      if (["+", "-", "*", "**", "+=", "-=", "*=", "/=", "%="].includes(bin.operator)) {
        result = bin;
      }
    },
  });
  return result;
}
