// @ts-nocheck
import * as parser from "@solidity-parser/parser";
import type { SourceUnit } from "@solidity-parser/parser/dist/src/ast-types";
import type { PragmaInfo } from "../types";

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

export interface ParsedSource {
  ast: SourceUnit;
  source: string;
  pragma?: PragmaInfo;
  contractName?: string;
}

const PRAGMA_REGEX = /pragma\s+solidity\s+(\^|>=|<=|=|~)?\s*(\d+)\.(\d+)\.(\d+)/;

export function parseSolidity(source: string): ParsedSource {
  let ast: SourceUnit;
  try {
    const result = parser.parse(source, { loc: true, tolerant: true, range: true });
    ast = result as SourceUnit;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ParseError(`Solidity parse error: ${message}`);
  }

  return {
    ast,
    source,
    pragma: extractPragma(source),
    contractName: extractFirstContractName(ast),
  };
}

function extractPragma(source: string): PragmaInfo | undefined {
  const match = source.match(PRAGMA_REGEX);
  if (!match) return undefined;
  const majorStr = match[2];
  const minorStr = match[3];
  const patchStr = match[4];
  if (!majorStr || !minorStr || !patchStr) return undefined;
  const major = Number(majorStr);
  const minor = Number(minorStr);
  const patch = Number(patchStr);
  return {
    raw: match[0],
    major,
    minor,
    patch,
    pre080: major < 0 || (major === 0 && minor < 8),
  };
}

function extractFirstContractName(ast: SourceUnit): string | undefined {
  let found: string | undefined;
  parser.visit(ast, {
    ContractDefinition(node) {
      if (!found && node.name) {
        found = node.name;
      }
    },
  });
  return found;
}
