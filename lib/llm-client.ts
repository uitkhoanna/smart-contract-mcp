// =============================================================================
// LLM client for Cysic (`evaluate_quality` MCP tool / `POST /api/evaluate`).
// =============================================================================
// Reads CYSIC_* env vars lazily, builds an OpenAI-style chat-completions
// payload, calls the Cysic endpoint with native `fetch`, and validates the
// response with `zod`. Throws one of three bespoke error classes so callers
// (the REST route, the MCP tool, the smoke script) can map cleanly to
// HTTP codes / `isError: true` payloads without leaking stack traces.
//
// IMPORTANT — type placement:
//   The four supporting types (QualityFocus, QualityDimension, QualityIssue,
//   QualityReport) are *defined* in this file for now. AC-5 will relocate
//   them to `lib/types.ts` so MCP / REST / UI share one source of truth;
//   this file will re-export them so the public surface stays stable.
// =============================================================================

import { z } from "zod";

// ---------------------------------------------------------------------------
// Supporting types (relocated to lib/types.ts in AC-5).
// ---------------------------------------------------------------------------

export type QualityFocus =
  | "overall"
  | "security"
  | "gas"
  | "style"
  | "docs";

export type QualityGrade = "A" | "B" | "C" | "D" | "F";

export type QualitySeverity = "info" | "low" | "medium" | "high";

export interface QualityDimension {
  name: string;
  /** 0..100 */
  score: number;
  comment: string;
}

export interface QualityIssue {
  severity: QualitySeverity;
  category: string;
  title: string;
  description: string;
  suggestion: string;
  /** 1-based line number, or null when unknown. */
  line: number | null;
}

export interface QualityReport {
  contractName: string;
  pragma?: string;
  /** 0..100 */
  overallScore: number;
  grade: QualityGrade;
  summary: string;
  dimensions: QualityDimension[];
  issues: QualityIssue[];
  /** Model identifier the report was produced by. */
  model: string;
  /** ISO-8601 timestamp set on the server after the LLM call completes. */
  evaluatedAt: string;
  latencyMs: number;
}

// ---------------------------------------------------------------------------
// Error classes — codes are the contract the REST/MCP layers key off of.
// ---------------------------------------------------------------------------

export class LlmConfigError extends Error {
  public readonly code: "llm_not_configured" = "llm_not_configured";
  constructor(message = "CYSIC_API_KEY is not set") {
    super(message);
    this.name = "LlmConfigError";
  }
}

export class LlmUpstreamError extends Error {
  public readonly code: "llm_upstream_error" = "llm_upstream_error";
  public readonly status: number;
  public readonly bodySnippet: string;
  constructor(message: string, status: number, bodySnippet = "") {
    super(message);
    this.name = "LlmUpstreamError";
    this.status = status;
    this.bodySnippet = bodySnippet;
  }
}

export class LlmSchemaError extends Error {
  public readonly code: "llm_schema_error" = "llm_schema_error";
  constructor(message: string) {
    super(message);
    this.name = "LlmSchemaError";
  }
}

// ---------------------------------------------------------------------------
// Zod schema — single source of truth for what a valid QualityReport looks
// like on the wire. `parseAndValidate` is the only place this runs.
// ---------------------------------------------------------------------------

const QualityDimensionSchema = z.object({
  name: z.string().min(1),
  score: z.number().min(0).max(100),
  comment: z.string(),
});

const QualityIssueSchema = z.object({
  severity: z.enum(["info", "low", "medium", "high"]),
  category: z.string(),
  title: z.string().min(1),
  description: z.string(),
  suggestion: z.string(),
  line: z.number().int().nullable().optional(),
});

const QualityReportSchema = z.object({
  contractName: z.string(),
  pragma: z.string().nullable().optional(),
  overallScore: z.number().min(0).max(100),
  grade: z.enum(["A", "B", "C", "D", "F"]),
  summary: z.string(),
  dimensions: z.array(QualityDimensionSchema),
  issues: z.array(QualityIssueSchema),
  model: z.string(),
  evaluatedAt: z.string(),
  latencyMs: z.number(),
});

// ---------------------------------------------------------------------------
// Lazy env reading — never snapshot at import time so Vercel cold starts
// pick up the latest .env.local values without a rebuild.
// ---------------------------------------------------------------------------

interface CysicConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
  temperature: number;
  maxTokens: number;
}

function readCysicConfig(): CysicConfig {
  const apiKey = (process.env.CYSIC_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new LlmConfigError(
      "CYSIC_API_KEY is not set. Copy env.example to .env.local and paste a real key, " +
        "or set the variable in your Vercel project settings, before calling " +
        "evaluateContractQuality.",
    );
  }
  const baseUrl = (process.env.CYSIC_BASE_URL ?? "https://token-ai.cysic.xyz/v1").trim();
  const model = (process.env.CYSIC_MODEL ?? "minimax-m3").trim();
  const timeoutMs = Number.parseInt(process.env.CYSIC_TIMEOUT_MS ?? "30000", 10);
  const temperature = Number.parseFloat(process.env.CYSIC_TEMPERATURE ?? "0.2");
  const maxTokens = Number.parseInt(process.env.CYSIC_MAX_TOKENS ?? "2048", 10);
  return {
    apiKey,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    model,
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 30000,
    temperature: Number.isFinite(temperature) ? temperature : 0.2,
    maxTokens: Number.isFinite(maxTokens) && maxTokens > 0 ? maxTokens : 2048,
  };
}

function redactApiKey(apiKey: string): string {
  if (apiKey.length <= 6) return "…";
  return `${apiKey.slice(0, 6)}…`;
}

// ---------------------------------------------------------------------------
// Prompt builders — system prompt embeds the exact JSON contract so the LLM
// is far more likely to first-shot a valid response. User prompt truncates
// very large sources to keep token usage predictable.
// ---------------------------------------------------------------------------

const MAX_SOURCE_LINES = 400;
const TRUNCATE_HEAD_LINES = 60;
const TRUNCATE_TAIL_LINES = 40;

function buildSystemPrompt(focus: QualityFocus): string {
  return [
    "You are a Solidity smart contract quality reviewer.",
    "You evaluate contracts across multiple dimensions (documentation, style, gas efficiency, error handling, events, modularity, best practices) and return a single JSON object — no markdown, no commentary, no code fences.",
    "",
    "The desired JSON shape (strict):",
    "",
    "{",
    '  "contractName": string,',
    '  "pragma": string | null,',
    '  "overallScore": number,         // 0..100 integer',
    '  "grade": "A" | "B" | "C" | "D" | "F",',
    '  "summary": string,              // 1-3 sentence executive summary',
    '  "dimensions": [',
    '    { "name": string, "score": number /*0..100*/, "comment": string }',
    "  ],",
    '  "issues": [',
    "    {",
    '      "severity": "info" | "low" | "medium" | "high",',
    '      "category": string,',
    '      "title": string,',
    '      "description": string,',
    '      "suggestion": string,',
    '      "line": number | null',
    "    }",
    "  ],",
    '  "model": string,                // echo the model name you are running on',
    '  "evaluatedAt": string,          // ISO-8601 timestamp',
    '  "latencyMs": 0                  // we fill this in server-side',
    "}",
    "",
    "Grading bands: A ≥ 90, B ≥ 75, C ≥ 60, D ≥ 40, else F.",
    "Per-dimension scores use the same bands.",
    `If the source exceeds ${MAX_SOURCE_LINES} lines, summarize the first ${TRUNCATE_HEAD_LINES} and last ${TRUNCATE_TAIL_LINES} lines in your reasoning and reference line ranges (e.g. "lines 412-450") for findings elsewhere.`,
    focus === "overall"
      ? ""
      : `Focus this review on the "${focus}" dimension; cover other dimensions lightly.`,
    "Return ONLY the JSON object. Do not wrap it in a code fence.",
  ]
    .filter((line) => line !== null && line !== undefined)
    .join("\n");
}

function buildUserPrompt(source: string, contractName?: string): string {
  const header = contractName
    ? `contract_name: ${contractName}`
    : "contract_name: <unknown>";
  const truncated = maybeTruncateSource(source);
  return [
    header,
    "",
    "Solidity source:",
    "",
    "```solidity",
    truncated.body,
    "```",
    "",
    truncated.notice,
    "",
    "Review the contract above and return the JSON object described in the system message.",
  ].join("\n");
}

function maybeTruncateSource(source: string): { body: string; notice: string } {
  const lines = source.split(/\r?\n/);
  if (lines.length <= MAX_SOURCE_LINES) {
    return { body: source, notice: "(no truncation applied)" };
  }
  const head = lines.slice(0, TRUNCATE_HEAD_LINES).join("\n");
  const tail = lines.slice(-TRUNCATE_TAIL_LINES).join("\n");
  return {
    body: `${head}\n\n// … ${lines.length - TRUNCATE_HEAD_LINES - TRUNCATE_TAIL_LINES} lines elided …\n\n${tail}`,
    notice: `(source had ${lines.length} lines; truncated to first ${TRUNCATE_HEAD_LINES} + last ${TRUNCATE_TAIL_LINES} for review)`,
  };
}

// ---------------------------------------------------------------------------
// Public entry point.
// ---------------------------------------------------------------------------

export interface EvaluateContractQualityOptions {
  focus?: QualityFocus;
  /** Optional external AbortSignal to cancel the call early. */
  signal?: AbortSignal;
}

export async function evaluateContractQuality(
  source: string,
  contractName?: string,
  focus: QualityFocus = "overall",
  signal?: AbortSignal,
): Promise<QualityReport> {
  const config = readCysicConfig();
  const startedAt = Date.now();

  const systemPrompt = buildSystemPrompt(focus);
  const userPrompt = buildUserPrompt(source, contractName);

  const payload = {
    model: config.model,
    temperature: config.temperature,
    max_tokens: config.maxTokens,
    messages: [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userPrompt },
    ],
  };

  const url = `${config.baseUrl}/chat/completions`;

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), config.timeoutMs);
  // Link an external AbortSignal if one was passed.
  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", () => controller.abort(), { once: true });
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as { name?: string })?.name === "AbortError") {
      throw new LlmUpstreamError(
        `LLM call exceeded ${config.timeoutMs}ms timeout (key=${redactApiKey(config.apiKey)})`,
        0,
        "timeout",
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new LlmUpstreamError(
      `LLM call failed: ${message} (key=${redactApiKey(config.apiKey)})`,
      0,
      "network_error",
    );
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    const snippet = text.slice(0, 500);
    throw new LlmUpstreamError(
      `LLM returned ${response.status} ${response.statusText} (key=${redactApiKey(config.apiKey)})`,
      response.status,
      snippet,
    );
  }

  // First parse: the OpenAI-style envelope.
  const envelopeText = await response.text();
  let envelope: unknown;
  try {
    envelope = JSON.parse(envelopeText);
  } catch {
    throw new LlmSchemaError(
      `LLM response is not JSON: ${envelopeText.slice(0, 200)}…`,
    );
  }

  const content = extractMessageContent(envelope);
  if (typeof content !== "string") {
    throw new LlmSchemaError(
      `LLM response is missing choices[0].message.content: ${JSON.stringify(envelope).slice(0, 200)}…`,
    );
  }

  // Second parse: the model content (may be wrapped in ```json fences).
  const report = parseAndValidate(content);

  // Override fields we own — never trust the LLM with these.
  const latencyMs = Date.now() - startedAt;
  const overallScore = clamp(Math.round(report.overallScore), 0, 100);
  const grade = gradeForScore(overallScore);
  const dimensions: QualityDimension[] = report.dimensions.map((d) => ({
    name: d.name,
    score: clamp(Math.round(d.score), 0, 100),
    comment: d.comment,
  }));
  const issues: QualityIssue[] = report.issues.map((i) => ({
    severity: i.severity,
    category: i.category,
    title: i.title,
    description: i.description,
    suggestion: i.suggestion,
    line: i.line ?? null,
  }));

  return {
    contractName: report.contractName?.trim() || contractName?.trim() || "<unknown>",
    pragma: report.pragma ?? undefined,
    overallScore,
    grade,
    summary: report.summary,
    dimensions,
    issues,
    model: config.model,
    evaluatedAt: new Date().toISOString(),
    latencyMs,
  };
}

// ---------------------------------------------------------------------------
// Internals.
// ---------------------------------------------------------------------------

function extractMessageContent(envelope: unknown): unknown {
  if (!envelope || typeof envelope !== "object") return undefined;
  const choices = (envelope as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return undefined;
  const first = choices[0] as { message?: { content?: unknown } };
  return first?.message?.content;
}

function parseAndValidate(content: string): z.infer<typeof QualityReportSchema> {
  // Defensively strip ```json ... ``` fences if the LLM ignored the prompt.
  const trimmed = content.trim();
  const stripped =
    trimmed.startsWith("```")
      ? trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "")
      : trimmed;

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    throw new LlmSchemaError(
      `LLM content is not JSON: ${stripped.slice(0, 200)}…`,
    );
  }

  const result = QualityReportSchema.safeParse(parsed);
  if (!result.success) {
    const detail = result.error.issues
      .map((i) => `${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("; ");
    throw new LlmSchemaError(`LLM content does not match QualityReport schema: ${detail}`);
  }
  return result.data;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function gradeForScore(score: number): QualityGrade {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}
