# Smart Contract Security Analyzer (MCP)

A production-ready Model-Context-Protocol (MCP) server that statically audits Solidity contracts for the seven classes of vulnerability most likely to drain your contract — **reentrancy, access control, integer overflow, unchecked low-level calls, timestamp dependence, tx.origin authorization, and unprotected selfdestruct**.

The server is built on Next.js 14 (App Router) and Vercel's `mcp-handler`, ships a marketing landing page, an interactive `/demo` playground, and a direct REST `POST /api/analyze` endpoint.

## Features

- **Four MCP tools:** `analyze_contract`, `check_vulnerability`, `generate_audit_report`, `suggest_fix`.
- **Seven AST-based detectors:** pure TypeScript walking the `@solidity-parser/parser` AST — no Python, no subprocess, no slither on Vercel.
- **Pragma-aware arithmetic detection:** only flags overflow on `< 0.8.0` contracts (or inside `unchecked {}` blocks on 0.8+).
- **Risk scoring with cap table:** critical 25/cap 50, high 15/cap 30, medium 10/cap 20, low 5/cap 10; clamped 0–100.
- **Markdown audit report generator:** executive summary, findings table, detailed findings, recommendations.
- **Interactive demo at `/demo`:** paste a contract, click "Analyze", see a live `RiskScore` and per-finding `VulnerabilityCard`s.
- **Dark theme + purple accent** (Tailwind) and copy-to-clipboard install instructions.

## Vulnerability coverage

| ID | SWC | Detector | Severity | Reference |
| --- | --- | --- | --- | --- |
| reentrancy | SWC-107 | External call before state write | critical | https://swcregistry.io/docs/SWC-107 |
| access_control | SWC-105 | Public state-mutating function with no `msg.sender` check | high | https://swcregistry.io/docs/SWC-105 |
| integer_overflow | SWC-101 | Unsigned arithmetic in pre-0.8 or `unchecked {}` | high | https://swcregistry.io/docs/SWC-101 |
| unchecked_calls | SWC-104 | Unwrapped low-level call return value | medium | https://swcregistry.io/docs/SWC-104 |
| timestamp_dependence | SWC-116 | `block.timestamp` in comparison or randomness | low | https://swcregistry.io/docs/SWC-116 |
| tx_origin | SWC-115 | `tx.origin` used for authorization | high | https://swcregistry.io/docs/SWC-115 |
| selfdestruct | SWC-106 | `selfdestruct`/`suicide` without access control | critical | https://swcregistry.io/docs/SWC-106 |

## Quick start (local development)

```bash
git clone https://github.com/your-org/smart-contract-mcp.git
cd smart-contract-mcp
npm install
npm run dev
```

Then open <http://localhost:3000> for the landing page or <http://localhost:3000/demo> for the interactive playground.

## Build & verify

```bash
npm run build           # type-check + Next.js production build
npm run typecheck       # tsc --noEmit
npm run lint            # next lint
npm run validate-schemas # exercise the four MCP tool schemas
```

## Install in Claude Desktop

Add the following to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS, `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "smart-contract-mcp": {
      "url": "https://smart-contract-mcp.vercel.app/api/mcp"
    }
  }
}
```

Restart Claude Desktop. You can now ask Claude to "audit this contract" or "check this function for reentrancy" and the four tools will be available.

## Deploy to Vercel

1. Push the repo to GitHub.
2. Import it in Vercel — the default Next.js build command is correct.
3. No environment variables are required.

The `vercel.json` in the repo pins the framework to `nextjs`; `@solidity-parser/parser` is declared in `next.config.ts` as an external server-component package so it is not bundled into the client.

## API surface

### MCP endpoint
- `GET  /api/mcp` — list tools + server info.
- `POST /api/mcp` — JSON-RPC `tools/call` invocations.
- `DELETE /api/mcp` — session teardown.

### Direct REST
- `POST /api/analyze` — `{ source_code, contract_name? }` → `AnalysisResult` JSON.

## Source layout

```
app/             # Next.js App Router (landing, /demo, /api/mcp, /api/analyze)
components/      # Hand-authored UI primitives (Button, Card, Badge, ...)
lib/             # Types, scoring, analyzers/*
scripts/         # smoke-mcp.mjs, validate-schemas.mjs, vulnerable-bank-payload.json
public/og.png    # 1200x630 social card
```

## License

MIT.
