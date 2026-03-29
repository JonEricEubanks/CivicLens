# CivicLens — Architectural Reasoning Log

Every significant design decision is documented here with alternatives considered and rationale.

---

### Project Concept: CivicLens — Municipal Intelligence Reporter
- **Decision**: Build CivicLens, a public-facing AI agent that generates on-demand reports, dashboards, and plain-language summaries of municipal infrastructure data — serving residents, council members, and journalists.
- **Alternatives**: (1) A general-purpose chatbot, (2) A developer productivity tool, (3) A content generation app.
- **Rationale**: Municipal government is one of the most underserved, high-impact sectors for AI. Every municipality in the US needs a way for the public to interrogate infrastructure data in plain language. The civic transparency angle is genuinely novel, and the real-world impact story writes itself.

### 4-Stage Agent Pipeline (Intent → Data → Synthesis → Report)
- **Decision**: Use a 4-stage multi-agent pipeline with distinct roles rather than a single monolithic agent.
- **Alternatives**: (1) Single ReAct agent handling everything, (2) 2-stage (query + render), (3) Full autonomous multi-agent swarm.
- **Rationale**: 4 stages provide visible architectural depth observable in the UI trace, while remaining implementable by a solo builder. A single agent is less capable. A swarm is over-engineered and hard to demo.

### MCP Server with Read AND Write Tools
- **Decision**: Include 3 action tools (dispatch_crew, update_work_order_status, schedule_inspection) alongside 5 read tools.
- **Alternatives**: (1) Read-only MCP (original spec), (2) Full CRUD including delete operations.
- **Rationale**: The core value proposition requires agents that TAKE ACTION. Read-only agents are information tools, not impact agents. Dispatch and status updates drive real-world outcomes directly. Deletes were excluded as unnecessary risk.

### Plain JavaScript over TypeScript
- **Decision**: Use plain JS with ES Modules rather than TypeScript.
- **Alternatives**: TypeScript with strict mode.
- **Rationale**: Time constraint as solo builder. JS eliminates compile step, tsconfig complexity, and type debugging time. Code quality is maintained through clear naming and structure.

### Evidence-Based Data Coverage over Fabricated LLM Confidence
- **Decision**: Replace LLM-generated "confidence" scores with evidence-based data coverage metrics.
- **Alternatives**: (1) Keep LLM confidence as-is, (2) Use Bayesian estimation, (3) Remove confidence entirely.
- **Rationale**: LLMs have no actual calibrated confidence — asking an LLM to output "confidence: 0.85" produces a fabricated number with no statistical meaning. This is the #1 Responsible AI violation in civic tech. Our data coverage metric (sources_consulted / total_sources × has_records) is verifiable, transparent, and directly measures how much data the report is based on.

### Human-in-the-Loop Action Confirmation
- **Decision**: Show a confirmation modal before executing any action tool (dispatch_crew, schedule_inspection).
- **Alternatives**: (1) Execute immediately, (2) Preview-only mode with manual execution, (3) Two-step API confirmation.
- **Rationale**: Civic infrastructure decisions shouldn't be automated without review. A confirmation modal balances agentic capability with safety — the AI proposes, the human confirms. This directly addresses safety and accountability.

### RAG Knowledge Grounding in Synthesis
- **Decision**: Integrate the 11-document municipal knowledge base into the synthesis stage via TF-IDF retrieval.
- **Alternatives**: (1) Keep RAG separate/unused, (2) Use RAG only for a separate Q&A endpoint, (3) Dense embedding-only retrieval.
- **Rationale**: Without domain knowledge grounding, the LLM generates plausible but unverifiable narrative. With RAG, the synthesis agent can cite specific municipal codes (§7-3-1), APWA standards, and safety requirements. This transforms the output from "AI opinion" to "AI-augmented policy analysis." TF-IDF fallback ensures retrieval works even without network access to embedding API.

### Data Persistence + Audit Logging
- **Decision**: Write mutations to disk via JSON file persistence and log all actions to a JSONL audit trail.
- **Alternatives**: (1) In-memory only, (2) SQLite, (3) Full database.
- **Rationale**: In-memory data that vanishes on restart looks broken during demos. JSON file persistence is the simplest durable solution — no dependencies, instant setup. SQLite adds complexity without benefit at this scale. The JSONL audit log provides accountability for all AI-driven actions, a core Responsible AI requirement for civic tech.

### Graceful Degradation over Crash-on-Error
- **Decision**: Wrap all MCP tool calls in error recovery (`safeCallTool`) that returns empty data instead of throwing.
- **Alternatives**: (1) Let errors propagate and crash the pipeline, (2) Retry with exponential backoff.
- **Rationale**: One network hiccup shouldn't crash the entire pipeline. The synthesis agent can still generate a partial report with a "data retrieval encountered issues" disclaimer. Retries add latency that kills demo flow. The `fallback_used` flag tells downstream stages to add appropriate caveats.

### Raw http.createServer over Express
- **Decision**: Use Node.js built-in `http.createServer` instead of Express, Fastify, or other frameworks.
- **Alternatives**: (1) Express.js, (2) Fastify, (3) Hono, (4) Next.js API routes.
- **Rationale**: `http.createServer` eliminates the entire middleware abstraction layer, keeping the server under 1,100 lines with zero routing dependencies. Every route, CORS header, rate limiter, and SSE stream is hand-written — the full server is readable in one file without chasing through middleware chains. Express would add ~30 transitive dependencies for functionality we implement in ~50 lines of vanilla code. Fewer dependencies means fewer failure modes.

### Weibull Decay Model Parameters
- **Decision**: Use Weibull parameters calibrated from APWA infrastructure decay curves (pothole k=1.8/λ=120, sidewalk k=2.2/λ=240, concrete k=2.5/λ=365).
- **Alternatives**: (1) Linear decay, (2) Exponential decay, (3) Fixed priority categories.
- **Rationale**: Weibull distribution is the standard reliability engineering model for infrastructure failure. The shape parameter k>1 models increasing failure rate (bathtub curve right side), which matches how potholes worsen exponentially after initial formation. λ values represent median time-to-critical for each infrastructure type. These specific values are derived from APWA Infrastructure Maintenance Manual decay rate tables for northern Illinois climate conditions.
