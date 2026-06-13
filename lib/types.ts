// Public types shared by detectors, API routes, MCP tools, and UI components.

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type RiskLevel = "low" | "medium" | "high" | "critical";

/**
 * SWC vulnerability identifiers exposed by the analyzer.
 * The set is the seven detectors documented in the README.
 */
export type VulnerabilityId =
  | "reentrancy"
  | "access_control"
  | "integer_overflow"
  | "unchecked_calls"
  | "timestamp_dependence"
  | "tx_origin"
  | "selfdestruct";

export interface SourceLocation {
  /** 1-based line number, or null when unknown. */
  line: number | null;
  /** 1-based column number, or null when unknown. */
  column: number | null;
  /** Enclosing function name when known. */
  functionName?: string | null;
}

export interface Vulnerability {
  id: VulnerabilityId;
  /** SWC registry id, e.g. "SWC-107". */
  swcId: string;
  title: string;
  description: string;
  severity: Severity;
  /** Pre-baked markdown remediation snippet, surfaced by the audit report and suggest_fix. */
  remediation: string;
  /** Optional reference link in the SWC registry. */
  reference?: string;
  location?: SourceLocation;
  /** The original raw source slice (3-line window) that contains the issue. */
  codeSnippet?: string;
}

export interface AnalysisResult {
  contractName: string;
  pragma?: string;
  riskScore: number;
  riskLevel: RiskLevel;
  vulnerabilities: Vulnerability[];
  summary: string;
  analyzedAt: string;
  detectorCount: number;
}

export interface PragmaInfo {
  raw: string;
  major: number;
  minor: number;
  patch: number;
  /**
   * Convenience flag — true when the major version is < 0.8 (no built-in
   * arithmetic overflow check).
   */
  pre080: boolean;
}
