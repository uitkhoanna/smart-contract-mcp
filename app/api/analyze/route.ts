import { NextResponse } from "next/server";
import { z } from "zod";
import { analyze, ParseError } from "@/lib/analyzers";

export const runtime = "nodejs";

const Body = z.object({
  source_code: z.string().min(1, "source_code must not be empty"),
  contract_name: z.string().min(1).optional(),
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
    const result = analyze(parsed.data.source_code, parsed.data.contract_name);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ParseError) {
      return NextResponse.json(
        { error: "parse_error", message: err.message },
        { status: 400 },
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "internal_error", message },
      { status: 500 },
    );
  }
}
