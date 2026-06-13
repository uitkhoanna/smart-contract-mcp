// @ts-nocheck
import type { SourceUnit } from "@solidity-parser/parser/dist/src/ast-types";
import type { PragmaInfo } from "../types";
import type { ParsedSource } from "./parser";

/**
 * Context passed to every detector. Detectors use this to access the AST,
 * the raw source, the parsed pragma, and to track the enclosing function
 * name as they walk the tree.
 */
export class DetectorContext {
  public readonly ast: SourceUnit;
  public readonly source: string;
  public readonly pragma?: PragmaInfo;
  public readonly contractName?: string;
  public readonly functionStack: string[] = [];

  constructor(parsed: ParsedSource) {
    this.ast = parsed.ast;
    this.source = parsed.source;
    this.pragma = parsed.pragma;
    this.contractName = parsed.contractName;
  }

  get currentFunction(): string | undefined {
    return this.functionStack[this.functionStack.length - 1];
  }

  /** Extract a small (3-line) window of source around a 1-based line number. */
  snippet(line: number | null | undefined, padding = 2): string {
    if (!line) return "";
    const lines = this.source.split("\n");
    const start = Math.max(0, line - 1 - padding);
    const end = Math.min(lines.length, line + padding);
    return lines.slice(start, end).join("\n");
  }

  loc(node: { loc?: { start?: { line?: number; column?: number } } } | null | undefined): {
    line: number | null;
    column: number | null;
  } {
    const start = node?.loc?.start;
    return {
      line: typeof start?.line === "number" ? start.line : null,
      column: typeof start?.column === "number" ? start.column : null,
    };
  }
}
