# Building CivicLens: A Multi-Agent AI Platform for Municipal Infrastructure Intelligence

*How I built an agentic AI system that helps residents report potholes, predict infrastructure failures, and hold local government accountable — using JavaScript, GitHub Models, and the Model Context Protocol.*

---

## The Problem

Every city maintains databases of potholes, broken sidewalks, and work orders. But this data is locked behind FOIA requests, 311 phone trees, and PDF reports nobody reads.

I live in Lake Forest, Illinois. When my neighbor asked "are there any potholes near the school?" the answer required calling public works, waiting on hold, and hoping someone could cross-reference repair logs with school locations. That's a question a machine should answer in seconds.

**CivicLens** is my answer: an AI agent that turns municipal infrastructure data into plain-language intelligence, lets residents file service requests on a map, and uses a Weibull survival model to predict which repairs will fail next.

---

## Architecture: A 5-Stage Multi-Agent Pipeline

```
Intent Classification (4-model vote) → ReAct Data Agent → Quality Feedback → RAG Synthesis → Report Formatting
```

**Stage 1 — Intent Classification:** GPT-4o-mini classifies queries into 12 intent classes and extracts structured filters. But here's the twist: **four classifiers vote in parallel** — GPT-4o-mini, Phi-3-mini-4k-instruct, a keyword baseline, and an **on-device MobileBERT model** running via ONNX Runtime (`@huggingface/transformers`). If 3 of 4 agree, consensus overrides the primary. The local ONNX model means CivicLens classifies intents even when all cloud APIs are down. A sliding-window conversation memory (10 turns, persisted to disk) handles follow-ups like "*what about sidewalks?*" without repeating context.

**Stage 2 — ReAct Data Agent:** An LLM-driven **Reason + Act loop** that selects from 16 MCP tools, calls them in parallel, reflects on results, and iterates up to 5 times. Tool results are cached (5-min TTL). Falls back to deterministic routing if the LLM is unavailable.

**Stage 3 — RAG-Grounded Synthesis:** Reports are grounded in an **11-document knowledge base** (municipal codes, APWA repair standards, school zone safety, weather data, budget frameworks). Retrieval uses dense embeddings with a TF-IDF fallback using domain-boosted keywords. Inline citations `[1], [2]` reference specific source documents.

**Quality Feedback Loop:** If data coverage drops below 40%, the pipeline automatically retries with broadened filters before synthesis begins.

**Stage 4 — Report Formatting:** Adds evidence-based data coverage metrics (not fabricated LLM "confidence"), equity disclosures, limitation statements, and human-in-the-loop confirmation for action tools.

---

## The Weibull Survival Model

Most civic tech apps sort by date or severity. CivicLens uses **Weibull survival analysis** — the same math used in reliability engineering to predict machine failures.

Every issue gets a **priority score (0–400)** from six components: severity (0–160), Weibull age decay (0–80), school proximity (0–60, max within 200 ft), traffic volume (0–40), weather risk (0–30, freeze-thaw season peaks), and type modifier (0–30). The Weibull CDF models non-linear urgency — a 90-day pothole is 3× more urgent than a 30-day one because the failure probability curve steepens.

Beyond scoring, the model powers **predictive forecasting** (severity at 30/90/180 days, expected failure date) and **cost-of-inaction analysis** (escalating repair costs, daily liability exposure, savings-if-repaired-now) — giving budget analysts concrete numbers instead of vague priorities.

---

## 16 MCP Tools via JSON-RPC 2.0

The MCP server provides **8 read tools** (potholes, sidewalks, schools, work orders, service requests, request status, Chicago 311 benchmarks, data provenance), **4 RBAC-gated action tools** (dispatch crew, update status, schedule inspection, submit service request — all persisted with audit logging), and **4 compute tools** (priority scoring, deterioration forecasting, cost of inaction, what-if budget modeling). The same tools serve the ReAct agent, REST API, and future clients.

---

## Security & Offline Resilience

**Security:** 300 req/min rate limiting, circuit breaker for upstream 429s (300s cooldown), input sanitization (HTML/JS stripping), RBAC (public vs supervisor roles), staff PIN auth (SHA-256 + Bearer tokens), CSP + security headers, CORS allowlist, HTTPS enforcement in production.

**Offline degradation ladder:** Full cloud → partial cloud + local ONNX → local-only intent classification + template reports → keyword fallback. No API key required for basic operation.

---

## Eight Frontend Modules

Built on **Material Design 3** with collapsible side nav, mobile bottom nav, dark mode, and Google Material Symbols:

1. **Chat** — SSE-streamed pipeline visualization with real-time stage progress and trace data
2. **Service Portal** — 12-category wizard with Leaflet.js map pinning, photo upload, and SSE live status notifications
3. **Interactive Map** — color-coded circle markers, school markers, city boundary polygon, tabbed severity popups
4. **AI Insights** — auto-generated KPI cards, risk gauges, Chart.js visualizations, custom prompt bar
5. **Staff Operations** — full-page triage dashboard with multi-filter search and crew assignment (PIN-gated)
6. **NLP Dashboard** — six template cards with tab-based results (Overview, Breakdown, Chart)
7. **Report Generator** — 5 templates × 5 audiences, customizable sections, SVG charts, sidebar TOC, inline editing, print/PDF
8. **Demo Mode** — 7-step guided tour with auto-advance, progress dots, and play/pause controls

---

## Email Notifications

CivicLens sends automated emails on request submission and status changes, cascading through three transports: **Power Automate webhook** → **SMTP via Nodemailer** → **local HTML preview**. Templates are responsive (mobile 320px+) with a visual progress bar, status-specific colors, activity timeline, and deep-link tracking.

---

## Deployment & Persistence

Deploys to **Azure App Service** via `azd up` (Bicep IaC in `infra/`). **Azure Cosmos DB** (serverless) provides optional cloud persistence — auto-creates containers, seeds from JSON on first boot, syncs all mutations, falls back gracefully to JSON-only mode. GitHub Actions CI runs the full test suite on every push.

---

## Data Methodology

CivicLens uses **real municipal reference data**: actual Lake Forest School District 67 schools at verified GPS coordinates, ASTM D6433 severity methodology, RS Means 2024 cost estimates, federal ADA thresholds, Weibull parameters from published infrastructure engineering literature, and Chicago 311 benchmarks from the Open Data Portal. Infrastructure records use representative sample data calibrated against real municipal patterns — the standard approach for civic tech pilots. Every dataset includes machine-readable provenance metadata via the `get_data_provenance` MCP tool.

---

## How GitHub Copilot Built This

From a 28-item improvement list, Copilot helped me refactor the data agent from a switch/case pattern into a React loop, add conversation memory, strengthen security, implement predictive forecasting, write 14 test suites, and set up CI—within a single session.

Key lesson: use AI to review AI. Copilot caught blind spots I would’ve likely missed in manual testing, and the project ended up stronger because of it.

---

## Responsible AI

- **No fabricated metrics** — data coverage from verifiable evidence, not LLM hallucination
- **Source transparency** — every claim links to MCP tools and RAG documents via full pipeline trace
- **Equity awareness** — reports disclose that proximity-based prioritization may advantage certain neighborhoods
- **Human oversight** — action tools require explicit confirmation; all actions logged to audit trail
- **Feedback loop** — users can report inaccuracies directly on generated reports

---

## Try It

- **Live Demo**: [civiclens-app.azurewebsites.net](https://civiclens-app.azurewebsites.net)
- **GitHub**: [github.com/JonEricEubanks/CivicLens](https://github.com/JonEricEubanks/CivicLens)

---

*Built for the JavaScript AI Build-a-thon Season 2. Powered by GitHub Models (GPT-4o-mini + Phi-3-mini-4k-instruct), on-device ONNX inference (MobileBERT), the Model Context Protocol, Azure Cosmos DB, and Node.js.*
