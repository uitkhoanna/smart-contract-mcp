// @ts-nocheck
import type { AnalysisResult, Vulnerability } from "../types";
import { calculateRiskScore, riskLevel } from "../scoring";
import { DetectorContext } from "./context";
import { parseSolidity, ParseError } from "./parser";
import { detectReentrancy } from "./reentrancy";
import { detectAccessControl } from "./access-control";
import { detectIntegerOverflow } from "./integer-overflow";
import { detectUncheckedCalls } from "./low-level-calls";
import { detectTimestampDependence } from "./timestamp";
import { detectTxOrigin } from "./tx-origin";
import { detectSelfdestruct } from "./selfdestruct";

export { ParseError };

/**
 * Top-level analysis entry point used by both the REST endpoint and the
 * MCP tools. Returns an `AnalysisResult` containing every detected
 * vulnerability, a derived risk score, and a human-readable summary.
 */
export function analyze(source: string, contractName?: string): AnalysisResult {
  const parsed = parseSolidity(source);
  const ctx = new DetectorContext(parsed);

  const all: Vulnerability[] = [
    ...detectReentrancy(ctx),
    ...detectAccessControl(ctx),
    ...detectIntegerOverflow(ctx),
    ...detectUncheckedCalls(ctx),
    ...detectTimestampDependence(ctx),
    ...detectTxOrigin(ctx),
    ...detectSelfdestruct(ctx),
  ];

  // Stable ordering: severity desc, then line asc, then title asc.
  const SEVERITY_ORDER: Record<Vulnerability["severity"], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };
  const sorted = [...all].sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sev !== 0) return sev;
    const al = a.location?.line ?? 0;
    const bl = b.location?.line ?? 0;
    if (al !== bl) return al - bl;
    return a.title.localeCompare(b.title);
  });

  const score = calculateRiskScore(sorted);
  const level = riskLevel(score);
  const name = contractName || ctx.contractName || "UnnamedContract";

  const criticalCount = sorted.filter((v) => v.severity === "critical").length;
  const highCount = sorted.filter((v) => v.severity === "high").length;
  const summary =
    `Contract ${name} has ${criticalCount} critical and ${highCount} high-severity issue(s). ` +
    `Overall risk score: ${score}/100 (${level}). Immediate remediation is recommended.`;

  return {
    contractName: name,
    pragma: ctx.pragma?.raw,
    riskScore: score,
    riskLevel: level,
    vulnerabilities: sorted,
    summary,
    analyzedAt: new Date().toISOString(),
    detectorCount: 7,
  };
}
