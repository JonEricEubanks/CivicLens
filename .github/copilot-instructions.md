# CivicLens — Project Instructions

## Project Overview

CivicLens is a Municipal Intelligence Reporter — an AI agent system that generates on-demand reports, dashboards, and plain-language summaries of municipal infrastructure data.

## Architecture

- **MCP Server** (`mcp-server/`): JSON-RPC 2.0 over HTTP, 8 tools (5 read + 3 action)
- **Agent Pipeline** (`agent/`): 4-stage LangChain.js pipeline (Intent → Data → Synthesis → Report)
- **RAG** (`rag/`): Policy document retrieval via FAISS + Ollama embeddings
- **Scoring** (`scoring/`): Weibull decay priority scoring model
- **API Server** (`server.js`): Node.js HTTP server
- **UI** (`public/`): Single HTML + Tailwind chat interface with agent trace visualization

## Code Style

- JavaScript ES Modules (`type: "module"` in package.json)
- No TypeScript (plain JS for development speed)
- Use `import`/`export`, never `require`
- Async/await over raw promises
- Descriptive variable names, no abbreviations

## Mandatory Tracking Rules

**CRITICAL — Follow these on EVERY code change:**

1. **CHANGELOG.md**: After every file creation or modification, append an entry to `CHANGELOG.md` with:
   - Date/time (ISO 8601)
   - Files changed
   - What changed and why (1-2 sentences)

2. **REASONING.md**: Before making any architectural or design decision, document it in `REASONING.md` with:
   - The decision made
   - Alternatives considered
   - Why this choice was selected

3. **PROMPTS.md**: When using notable prompts or prompt engineering strategies, capture them in `PROMPTS.md`.

## Build & Run

```bash
npm install          # Install dependencies
npm run build        # Build CSS + copy vendor assets
npm start            # Start API server (auto-launches MCP server)
npm run ingest       # Ingest RAG policy documents
```

## Key Data

- Domain: Lake Forest, IL infrastructure
- Geo bounds: ~42.23–42.27 lat, ~-87.83–-87.85 lng
- Zones: NW-3, NE-1, SE-2, SW-1
- Weibull decay: Potholes k=1.8/λ=120, Sidewalks k=2.2/λ=240, Concrete k=2.5/λ=365
