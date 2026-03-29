# CivicLens — AI-Assisted Development Log

Documenting prompts, workflows, and AI tool usage throughout development.

---

### Project Planning & Architecture Design
- **Tool**: GitHub Copilot (Agent Mode, Claude)
- **Prompt**: "I need help planning to build something for this project" + full project requirements
- **Result**: Complete project plan with 4-stage agent architecture, tech stack, and timeline. Key insight: agents must TAKE ACTION (dispatch crews, update statuses) not just retrieve data.
- **Tip**: Providing the full project requirements upfront let the AI evaluate every decision against the goals. This caught a design risk early.

### Competitive Analysis
- **Tool**: GitHub Copilot (Agent Mode)
- **Prompt**: Analyzed similar projects to identify differentiation opportunities
- **Result**: Identified that most similar projects use single-agent patterns. Our 4-stage pipeline and responsible AI implementation (source citations, confidence indicators) are clear differentiators.
- **Tip**: Studying the landscape early revealed that strong UX polish + architectural depth is the best combination. Plan the UI design direction alongside the backend, not as an afterthought.

### RAG Knowledge Base Development
- **Tool**: GitHub Copilot (Agent Mode, Claude)
- **Prompt**: "Build a RAG knowledge base for CivicLens with municipal codes, APWA repair standards, school safety requirements, weather impacts, and budget data for Lake Forest, IL"
- **Result**: 11-document knowledge base across 6 categories with dual retrieval (TF-IDF with domain boosting + dense embeddings). 34 comprehensive tests all passing. Domain-boosted terms increase retrieval accuracy for municipal vocabulary.
- **Tip**: Building the knowledge base as a standalone module with comprehensive tests first made integration into the synthesis pipeline trivial later.

### NLP Dashboard & Report Generator
- **Tool**: GitHub Copilot (Agent Mode, Claude)
- **Prompt**: Detailed specs for full-screen analytics dashboard and report builder with templates, audiences, section types, and export capabilities
- **Result**: Two complete frontend modules: nlp-dashboard.js (Chart.js charts, pipeline animation, KPIs) and report-generator.js (4 templates, 4 audiences, 12 section types, SVG charts, inline editing). Both integrate with the dashboard API endpoint.
- **Tip**: Providing very detailed specs with exact feature lists, layout descriptions, and interaction patterns produces much better results than vague requests.

### Critical Review & Responsible AI Overhaul
- **Tool**: GitHub Copilot (Agent Mode, Claude)
- **Prompt**: "Act as a critical reviewer and evaluate every file in the project. Score each area 1-10 with specific evidence. List the TOP 10 things that must be fixed."
- **Result**: Devastating but accurate review scoring the project at 4.94/10. Key findings: (1) fabricated LLM confidence scores are a Responsible AI failure, (2) data doesn't persist across restarts, (3) RAG module was dead code never used, (4) zero error recovery in data pipeline, (5) no README or setup instructions. This led to a complete overhaul of Responsible AI practices.
- **Tip**: Using AI to critique your own AI project reveals blind spots you'd never find yourself. The harsh reviewer prompt format forces specific, actionable feedback instead of generic encouragement.
