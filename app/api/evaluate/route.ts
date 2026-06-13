import { NextResponse } from "next/server";
import { z } from "zod";
import {
  evaluateContractQuality,
  LlmConfigError,
  LlmUpstreamError,
  LlmSchemaError,
} from "@/lib/llm-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FOCUS_VALUES = ["overall", "security", "gas", "style", "docs"] as const;

const Body = z.object({
  source_code: z.string().min(1, "source_code must not be empty"),
  contract_name: z.string().min(1).optional(),
  focus: z.enum(FOCUS_VALUES).optional(),
});

export async function POST(request: Request): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Request body must be JSON." },
      { status: 400 },
    );
  }

  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const report = await evaluateContractQuality(
      parsed.data.source_code,
      parsed.data.contract_name,
      parsed.data.focus ?? "overall",
    );
    return NextResponse.json(report);
  } catch (err) {
    // Map the three bespoke LLM error classes to HTTP codes without leaking
    // stack traces. `code` is the stable contract clients key off of.
    if (err instanceof LlmConfigError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: 503 },
      );
    }
    if (err instanceof LlmUpstreamError) {
      return NextResponse.json(
        { error: err.code, message: err.message, upstreamStatus: err.status },
        { status: 502 },
      );
    }
    if (err instanceof LlmSchemaError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: 502 },
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "internal_error", message },
      { status: 500 },
    );
  }
}
