# CivicLens — Changelog

All changes to the project are documented here in reverse chronological order.

---

### [2026-03-23] — v2.2: Multi-Model Validation, Cosmos DB, & Data Provenance
- **Files**: `agent/intent-agent.js`, `agent/pipeline.js`, `agent/report-agent.js`, `lib/data-layer.js`, `lib/cosmos-layer.js` (new), `mcp-server/server.js`, `mcp-server/data/data-provenance.json` (new), `README.md`, `BLOG.md`, `.env.example`
- **Changes**:
  - **Multi-Model Intent Validation** — Phi-3-mini-4k-instruct now runs in parallel with GPT-4o-mini for intent classification. Cross-model agreement is logged and surfaced in pipeline trace. Keyword baseline provides a third opinion. Zero added latency via `Promise.allSettled()`.
  - **Azure Cosmos DB Integration** — optional cloud persistence layer using `@azure/cosmos`. Auto-creates `civiclens` database with containers for workOrders, potholes, sidewalkIssues, schools, serviceRequests, and auditLog. Seeds from JSON on first boot. All mutations sync to both JSON and Cosmos. Graceful fallback to JSON-only mode when Cosmos is unavailable.
  - **Data Provenance System** — new `data-provenance.json` manifest documenting real-world sources, calibration methods, and validation benchmarks for every dataset. New `get_data_provenance` MCP tool (16th tool) exposes provenance metadata programmatically.
  - **Report Trace Enhancement** — intent classification trace now includes model name, validator model, and agreement status.
  - **RBAC Update** — `get_data_provenance` added to public tool allowlist.
  - **Documentation** — README and BLOG updated to reflect multi-model validation, Cosmos DB architecture, data methodology, and 16-tool MCP server.

---

### [2026-03-23] — v2.1: Solution Value & Operational Hardening
- **Files**: `server.js`, `agent/pipeline.js`, `public/index.html`, `public/service-portal.js`, `mcp-server/server.js`, `package.json`, `README.md`
- **Changes**:
  - **Resolution Pipeline Widget** — dashboard funnel showing Open → In Progress → Resolved outcomes with stacked progress bar and completion percentage.
  - **Cost Impact Widget** — before/after repair cost comparison powered by Weibull cost-of-inaction, showing savings from timely repairs vs projected cost if delayed.
  - **Chicago 311 Benchmarks Widget** — cross-city comparison (Lake Forest vs Chicago 311) across response time, resolution rate, and satisfaction metrics.
  - **SSE Live Notifications** — real-time status updates in service portal detail view with LIVE badge indicator and auto-cleanup on navigation.
  - **Community API Enhancement** — `/api/community` now returns `cost_savings` (total repairs, total cost, total savings, projected cost if delayed) and `benchmarks` (Lake Forest vs Chicago 311) data.
  - **MCP Consolidation** — standalone MCP server now has all 15 tools + RBAC; removed embedded `/mcp` endpoint from API server.
  - **Auto-Launch MCP** — `server.js` auto-forks MCP server via `child_process.fork()` on startup; single `npm start` command runs everything.
  - **CDN Bundling** — Chart.js, Leaflet, marked.js bundled locally in `public/vendor/` to eliminate CDN fragility.
  - **CSP Header** — Content-Security-Policy HTTP header added to all responses (self + inline scripts/styles + Google Fonts + OpenStreetMap tiles).
  - **Conversation Memory Persistence** — conversation memory now persists to `mcp-server/data/conversation-memory.json`, survives server restarts, loads on startup.
  - **Lint Script** — `npm run lint` added using `node --check` for syntax validation of all JS files.
  - **README Overhaul** — updated to reflect 15 MCP tools, single-command startup, 5-stage pipeline, RBAC, live notifications, benchmarks, cost impact, security features.

### [2026-03-22] — v2.0: Agentic Architecture & Security Overhaul
- **Files**: `agent/data-agent.js`, `agent/pipeline.js`, `agent/intent-agent.js`, `agent/synthesis-agent.js`, `agent/report-agent.js`, `scoring/weibull.js`, `server.js`, `public/index.html`, `package.json`, `azure.yaml`, `BLOG.md`
- **New files**: `tests/weibull.test.js`, `tests/pipeline.test.js`, `.github/workflows/ci.yml`, `infra/main.bicep`, `infra/main.parameters.json`, `infra/modules/appservice.bicep`, `infra/abbreviations.json`
- **Changes**:
  - **ReAct Agentic Tool Loop** — fully rewrote `data-agent.js` from hardcoded switch/case to LLM-driven ReAct reasoning loop. Agent reasons step-by-step, selects from 14 tool schemas, executes tools in parallel, and iterates up to 5 times. Falls back to deterministic plan if LLM unavailable.
  - **Conversation Memory** — sliding-window memory (10 turns) in pipeline. Intent agent receives prior conversation for follow-up resolution. Memory can be cleared via `/api/memory/clear`.
  - **Quality Feedback Loop** — if data coverage < 40%, pipeline retries with broadened filters automatically.
  - **Predictive Forecasting** — `forecastDeterioration()` uses Weibull CDF to project severity at 30/90/180 days, calculates expected failure date, traffic-adjusted acceleration, and plain-language recommendations.
  - **Cost-of-Inaction Analysis** — `costOfInaction()` calculates escalating repair costs, daily liability exposure (school proximity + severity + traffic), and savings-if-repaired-now.
  - **What-If Budget Tool** — `whatif_budget` MCP tool models impact of budget changes, scores open work orders by priority, determines addressable vs deferred count.
  - **Security: Rate Limiting** — in-memory token bucket, 60 requests/min per IP with automatic cleanup.
  - **Security: Input Sanitization** — strips HTML tags, `javascript:` URIs, and `on*` event handlers from all user input.
  - **Security: RBAC** — role-based access control with public (read) vs supervisor (action) tool permissions.
  - **Security: Headers** — X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, Referrer-Policy, Permissions-Policy, HSTS (production).
  - **Security: CORS** — tightened from wildcard `*` to allowlist (localhost + Azure URL).
  - **RAG Inline Citations** — synthesis agent generates `[1], [2]` inline citations; report agent renders footnotes section.
  - **Data Export** — `/api/export` endpoint supports CSV and JSON export with nested object flattening and proper CSV escaping.
  - **SSE Notifications** — `/api/notifications/subscribe/:id` for real-time service request status updates.
  - **How It Works Modal** — interactive overlay explaining the full architecture (ReAct, Weibull, RAG, MCP, RAI).
  - **Report Inaccuracy Button** — users can flag AI-generated content directly on reports.
  - **Tests** — 24 unit/integration tests across 5 suites (Weibull scoring, forecasting, cost-of-inaction, report formatting, data integrity). All passing.
  - **CI Pipeline** — GitHub Actions workflow on push/PR to main, Node.js 20+22 matrix, npm ci + test + audit.
  - **azd Support** — `azure.yaml` manifest + Bicep templates for one-command Azure deployment via `azd up`.
  - **Blog Post** — comprehensive technical blog post in `BLOG.md` covering architecture, Weibull model, RAG, security, and Copilot development workflow.

### [2026-03-21T02:00] — Responsible AI & Production Hardening
- **Files**: `agent/report-agent.js`, `agent/data-agent.js`, `agent/synthesis-agent.js`, `agent/pipeline.js`, `mcp-server/server.js`, `public/index.html`
- **Changes**:
  - **Removed fabricated LLM confidence** — replaced with evidence-based data coverage metric (sources consulted / total sources × records analyzed)
  - **RAG Integration** — synthesis agent now retrieves relevant municipal codes, repair standards, and safety requirements from 11-document knowledge base to ground responses
  - **Data Persistence** — MCP action tools (dispatch, status update, inspection) now persist changes to disk via `fs.writeFile`
  - **Audit Logging** — all actions logged to `mcp-server/data/audit-log.jsonl` with timestamps, params, and results
  - **Action Confirmation** — UI shows human-in-the-loop confirmation modal before executing crew dispatch or inspections
  - **Error Recovery** — data agent wraps all MCP calls in `safeCallTool()` for graceful degradation instead of pipeline crashes
  - **Data Equity Disclosure** — reports include equity note about proximity-based prioritization
  - **Limitations Statement** — every report discloses analysis limitations
  - **Human-readable Sources** — tool names mapped to user-friendly labels in trace and reports
  - **Data Coverage Bar** — visual progress bar in chat UI showing data coverage percentage
  - **RAG Sources in Trace** — agent trace panel shows which knowledge base documents were retrieved
  - **Version Display** — UI shows version number

### [2026-03-21T01:00] — README & Documentation
- **Files**: `README.md`, `.env.example`, `CHANGELOG.md`, `REASONING.md`, `PROMPTS.md`
- **Change**: Comprehensive README with Quick Start, architecture diagram, feature table, Responsible AI section, project structure, and tech stack. Updated all governance docs.

### [2026-03-20T04:00] — NLP Dashboard & Report Generator
- **Files**: `public/nlp-dashboard.js`, `public/report-generator.js`, `server.js`, `public/index.html`
- **Change**: Full-screen AI analytics dashboard with Chart.js charts, 6 template cards, 5-phase pipeline animation, KPI counters, risk gauge. Report builder with 4 templates (Full Assessment/Board Brief/Community Update/Budget Request), 4 audiences, 12 section types, SVG charts, sidebar TOC, inline editing, light/dark theme.

### [2026-03-20T03:00] — RAG Knowledge Base
- **Files**: `rag/rag_knowledge_base.js`, `rag/test_rag_knowledge_base.js`
- **Change**: 11-document knowledge base across 6 categories (municipal code, repair standards, safety, weather, budget, Weibull model). Dual retrieval: TF-IDF with domain-boosted keywords + dense embeddings. 34/34 tests passing.

### [2026-03-20T00:00] — Project Scaffold
- **Files**: `.github/copilot-instructions.md`, `.github/instructions/tracking.instructions.md`, `CHANGELOG.md`, `REASONING.md`, `PROMPTS.md`
- **Change**: Initial project scaffold with workspace instructions, change tracking enforcement, and documentation files.

### [2026-03-20T01:00] — Core Implementation
- **Files**: `package.json`, `.env.example`, `.gitignore`, `mcp-server/server.js`, `mcp-server/data/work-orders.json`, `mcp-server/data/potholes.json`, `mcp-server/data/sidewalk-issues.json`, `mcp-server/data/schools.json`, `scoring/weibull.js`, `agent/mcp-client.js`, `agent/intent-agent.js`, `agent/data-agent.js`, `agent/synthesis-agent.js`, `agent/report-agent.js`, `agent/pipeline.js`, `server.js`, `public/index.html`
- **Change**: Full working implementation — MCP server with 8 tools (5 read + 3 action), Weibull decay scoring, 4-stage agent pipeline (Intent → Data → Synthesis → Report), API server, and chat UI with agent trace visualization.
