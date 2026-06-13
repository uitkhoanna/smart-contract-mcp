# Claude / Agent Standards — Smart Contract Security Analyzer (MCP)

## Project Summary
A production-ready Smart Contract Security Analyzer exposed as an MCP server on Vercel using Next.js App Router. The server exposes 4 MCP tools (`analyze_contract`, `check_vulnerability`, `generate_audit_report`, `suggest_fix`) backed by 7 AST-based Solidity vulnerability detectors. It also ships a marketing landing page, a `/demo` playground, and a direct REST `POST /api/analyze` endpoint for the web demo.

## Tech Stack
- **Framework:** Next.js 14 (App Router) + TypeScript (strict).
- **Styling:** Tailwind CSS with a dark theme and purple accent.
- **MCP:** `mcp-handler` (Vercel `mcp-handler` package) wrapping `@modelcontextprotocol/sdk`.
- **Analysis:** `@solidity-parser/parser` for AST + hand-written visitor detectors (no Python, no subprocess).
- **Validation:** `zod` for tool input schemas and request bodies.
- **Deployment:** Vercel. Server components only on the analyzer; the parser is declared an external server component package to keep the client bundle clean.

## Source Layout
```
app/
  api/
    mcp/route.ts          # MCP server (GET/POST/DELETE via mcp-handler)
    analyze/route.ts      # Direct REST analysis endpoint
  demo/page.tsx           # Interactive playground
  page.tsx                # Landing page
  layout.tsx              # Root layout
  globals.css             # Tailwind base + CSS variables
components/               # UI primitives (Button, Card, Textarea, Badge, Tabs, ...)
lib/
  types.ts                # Public types: Severity, Vulnerability, AnalysisResult
  scoring.ts              # Risk-score calculation + banding
  analyzers/
    parser.ts             # @solidity-parser/parser wrapper + pragma detection
    index.ts              # analyze(source) aggregator
    reentrancy.ts         # SWC-107
    access-control.ts     # SWC-105
    integer-overflow.ts   # SWC-101
    low-level-calls.ts    # SWC-104
    timestamp.ts          # SWC-116
    tx-origin.ts          # SWC-115
    selfdestruct.ts       # SWC-106
scripts/                  # Smoke-test scripts
public/og.png             # Social card
```

## Coding Conventions
- TypeScript strict mode. **No `any` in detector return types.** `loc` fields typed as `Location | null` and null-guarded.
- Use `import type` for type-only imports.
- Two-space indent, single quotes, no trailing semicolons in JSON, semicolons in `.ts/.tsx`.
- Tailwind utility-first; component variants via `class-variance-authority` only where reused.
- Dark theme is the default. Do not introduce a theme switcher.

## Detector Contract
Each detector in `lib/analyzers/<name>.ts` exports:
```ts
export function detect(ctx: DetectorContext): Vulnerability[]
```
`DetectorContext` carries the AST, raw source, parsed pragma, and a `functionStack: string[]` so detectors can attribute findings to the enclosing function name.

## MCP Tool Return Shape
Always:
```ts
{ content: [{ type: "text", text: JSON.stringify(result) }] }
```

## Verification
- Build: `npm run build` must exit 0 (AC-1).
- Lint: ESLint configured to fail on errors during build.
- Type check: `tsc --noEmit` must pass.

## Out of Scope
- Multi-file Solidity projects, compiler-grade type inference, gas estimation, on-chain lookups, persistent storage, slither/mythril integration, on-cluster deploy from this session.
