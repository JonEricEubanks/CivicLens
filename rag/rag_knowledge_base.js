/**
 * RAG Knowledge Base — CivicLens
 *
 * Lightweight in-memory RAG pipeline for municipal infrastructure domain knowledge.
 *
 * Retrieval strategies:
 *   1. Primary: Foundry text-embedding-3-small (1536-dim dense vectors, cosine similarity)
 *   2. Fallback: TF-IDF weighted term vectors with domain-boosted keywords (no network needed)
 *
 * Document sources:
 *   - 11 built-in documents (always available, zero network dependency)
 *   - Dynamic documents from rag/documents/ (fetched via `npm run ingest`)
 *     Sources: NOAA weather, NCES schools, Census ACS, Chicago 311, FHWA, APWA, IDOT, SRTS
 *
 * Production target: Azure AI Search (not used in current build)
 */

import { ChatOpenAI } from '@langchain/openai';
import { readFileSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── Knowledge Documents (11 documents, 6 categories) ──────────────────────

export const KNOWLEDGE_DOCS = [
  {
    id: 'mc-001',
    category: 'municipal_code',
    title: 'Lake Forest Municipal Code §7-3-1: Street Maintenance',
    content:
      'Lake Forest Municipal Code §7-3-1 establishes street maintenance standards and pothole repair timelines. ' +
      'Arterial roads require repair within 48 hours of report. Residential streets must be repaired within 7 calendar days. ' +
      'Potholes within 1,500 feet of a school must be repaired same-day when reported before noon, or by noon the following business day. ' +
      'DPW must log all reports in the work-order system within 2 hours of receipt. Failure to meet timelines triggers escalation to the City Manager.',
  },
  {
    id: 'mc-002',
    category: 'municipal_code',
    title: 'Ordinance §7-3-4: Sidewalk Repair Responsibility',
    content:
      'Ordinance §7-3-4 defines sidewalk repair cost-sharing between the City and adjacent property owners. ' +
      'The City pays 100% for ADA-required repairs, 50% for damage caused by City tree roots, and 0% for cosmetic-only damage. ' +
      'Property owners must be notified 30 days before work begins. ADA transition plan compliance is mandatory — all non-compliant ' +
      'sidewalks and curb ramps must be remediated by the 2028 federal deadline.',
  },
  {
    id: 'mc-003',
    category: 'municipal_code',
    title: 'Illinois Highway Code (605 ILCS 5/)',
    content:
      'The Illinois Highway Code (605 ILCS 5/) requires municipalities to conduct Pavement Condition Index (PCI) surveys every 2 years. ' +
      'Lake Forest receives approximately $2.4M/year in Motor Fuel Tax (MFT) funding, which must be spent on road maintenance and capital improvements. ' +
      'MFT funds cannot be used for sidewalks. PCI scores below 40 mandate reconstruction rather than patching.',
  },
  {
    id: 'rs-001',
    category: 'repair_standards',
    title: 'APWA Pothole Repair Standards',
    content:
      'American Public Works Association (APWA) recognizes four pothole repair methods. ' +
      'Throw-and-roll: fastest, temporary, $15-25 per patch, lasts 1-6 months. ' +
      'Semi-permanent: saw-cut and compact, $40-70 per patch, lasts 1-3 years. ' +
      'Full-depth: excavate and repave, $150-300 per patch, lasts 5-10 years. ' +
      'Infrared: heat and rework existing asphalt, $80-120 per patch, lasts 3-5 years, best for clusters. ' +
      'APWA recommends semi-permanent as the standard repair method when temperatures are above 40°F.',
  },
  {
    id: 'rs-002',
    category: 'repair_standards',
    title: 'APWA Sidewalk Repair Standards',
    content:
      'APWA classifies sidewalk damage into four classes. ' +
      'Class A: minor cracking, no trip hazard, monitor only. ' +
      'Class B: 0.25-0.5 inch vertical displacement, grind/shim repair, $5-15 per linear foot. ' +
      'Class C: 0.5-1.5 inch displacement, panel replacement, $20-40 per linear foot. ' +
      'Class D: >1.5 inch displacement or structural failure, full reconstruction, $50-80 per linear foot. ' +
      'ADA-compliant curb ramp installation costs $1,200-$2,500 per ramp. All Class C and D damage in pedestrian routes must include ADA ramp assessment.',
  },
  {
    id: 'sf-001',
    category: 'safety',
    title: 'School Zone Safety Buffer Requirements',
    content:
      'School zone safety buffers extend 1,500 feet from school property boundaries for infrastructure maintenance prioritization. ' +
      'All potholes and sidewalk hazards within this buffer must be repaired within 24 hours during the school year (Aug 15 – Jun 10). ' +
      'Safe Routes to School program designates primary walking paths that receive highest repair priority. ' +
      'Temporary hazard marking (orange cones/plates) is required within 4 hours if same-day repair is not possible. ' +
      'DPW must notify the school principal when repairs are scheduled on adjacent streets.',
  },
  {
    id: 'sf-002',
    category: 'safety',
    title: 'ADA Compliance Requirements',
    content:
      'ADA requires a minimum 48-inch clear sidewalk width (36 inches at constrictions for short distances). ' +
      'Maximum cross-slope is 2%. Maximum running slope is 5% (or match road grade). ' +
      'Curb ramps must have detectable warning surfaces (truncated domes). ' +
      'The 2028 ADA transition plan deadline requires municipalities to have a documented plan and demonstrate progress toward full compliance. ' +
      'Non-compliance exposes the city to federal civil rights complaints and potential loss of federal funding.',
  },
  {
    id: 'wi-001',
    category: 'weather',
    title: 'Weather Impact on Infrastructure Repairs',
    content:
      'Freeze-thaw cycles are the primary driver of pothole formation in northern Illinois, with 60-80 cycles per winter typical for Lake Forest. ' +
      'Hot-mix asphalt requires ambient temperature above 40°F and rising for proper compaction. ' +
      'Cold-mix asphalt is available for emergency winter repairs but has 50-70% shorter lifespan. ' +
      'The optimal repair window for permanent fixes is April through October. ' +
      'Spring (March-April) typically sees a 200-300% spike in pothole reports after winter freeze-thaw damage.',
  },
  {
    id: 'bp-001',
    category: 'budget',
    title: 'Lake Forest Infrastructure Budget Guidelines',
    content:
      'Lake Forest allocates $12.5M annually for infrastructure maintenance and capital improvements. ' +
      'Procurement thresholds: under $10K requires DPW Director approval, $10K-$25K requires competitive quotes (minimum 3), ' +
      '$25K-$50K requires formal sealed bids, over $50K requires City Council approval. ' +
      'Emergency repairs (safety hazards) can bypass normal procurement up to $25K with City Manager approval. ' +
      'Capital projects over $100K require a 60-day public comment period.',
  },
  {
    id: 'bp-002',
    category: 'budget',
    title: 'Cost-of-Inaction Analysis',
    content:
      'Delayed infrastructure repair follows an exponential cost curve. ' +
      'Potholes: repair cost multiplies 5-8x if deferred beyond 6 months (from $50 patch to $300+ reconstruction). ' +
      'Sidewalks: cost multiplies 3-5x if deferred beyond 2 years (from $15/ft grind to $80/ft reconstruction). ' +
      'Liability estimates: average pothole vehicle damage claim is $750, average sidewalk trip-and-fall claim is $15,000-$50,000. ' +
      'Lake Forest paid $127,000 in infrastructure-related liability claims in FY2024.',
  },
  {
    id: 'cr-001',
    category: 'crew_management',
    title: 'Crew Deployment Best Practices',
    content:
      'Standard pothole crew: 3 workers + 1 truck, handles 15-25 patches per 8-hour shift (throw-and-roll) or 6-10 (semi-permanent). ' +
      'Sidewalk crew: 4 workers + equipment, replaces 200-400 linear feet per day. ' +
      'School zone work restrictions: no heavy equipment within 1,500 feet of schools during arrival (7:30-8:30 AM) or dismissal (2:30-3:30 PM). ' +
      'Optimal crew dispatch prioritizes geographic clustering to minimize transit time — route planning should batch nearby work orders. ' +
      'Overtime (>40 hrs/week) costs 1.5x and requires Superintendent approval.',
  },
];

// ─── Dynamic document loading from rag/documents/ ───────────────────────────

const DOCS_DIR = join(__dirname, 'documents');

/**
 * Load ingested documents from rag/documents/*.json.
 * These are fetched by `npm run ingest` from public APIs (NOAA, Census, NCES, etc.).
 * Returns empty array if no ingested docs exist (graceful degradation).
 */
function loadExternalDocs() {
  if (!existsSync(DOCS_DIR)) return [];

  const files = readdirSync(DOCS_DIR).filter(
    (f) => f.endsWith('.json') && f !== 'manifest.json'
  );

  const docs = [];
  for (const file of files) {
    try {
      const raw = JSON.parse(readFileSync(join(DOCS_DIR, file), 'utf8'));
      if (raw.id && raw.title && raw.content) {
        docs.push({
          id: raw.id,
          category: raw.category || 'external',
          title: raw.title,
          content: raw.content,
        });
      }
    } catch {
      // Skip malformed files silently
    }
  }
  return docs;
}

const EXTERNAL_DOCS = loadExternalDocs();

/**
 * Combined document set: built-in + dynamically ingested.
 * All retrieval operates over this merged array.
 */
export const ALL_DOCS = [...KNOWLEDGE_DOCS, ...EXTERNAL_DOCS];

if (EXTERNAL_DOCS.length > 0) {
  console.log(`RAG: Loaded ${EXTERNAL_DOCS.length} external doc(s) from rag/documents/ (total: ${ALL_DOCS.length})`);
}

// ─── Required categories ────────────────────────────────────────────────────

export const REQUIRED_CATEGORIES = [
  'municipal_code',
  'repair_standards',
  'safety',
  'weather',
  'budget',
  'crew_management',
];

// ─── TF-IDF domain boost weights ────────────────────────────────────────────

const DOMAIN_BOOSTS = {
  pothole:    3.0,
  potholes:   3.0,
  sidewalk:   3.0,
  sidewalks:  3.0,
  school:     2.5,
  schools:    2.5,
  ada:        2.5,
  apwa:       2.5,
  emergency:  2.0,
  repair:     2.0,
  safety:     2.0,
  crew:       2.0,
  budget:     2.0,
  weibull:    2.0,
  priority:   2.0,
  zone:       2.0,
  arterial:   2.0,
  freeze:     2.0,
  thaw:       2.0,
  inspection: 2.0,
  dispatch:   2.0,
};

// ─── Internal state ─────────────────────────────────────────────────────────

let denseEmbeddings = null;   // Map<docId, Float64Array(1536)>
let embeddingMethod = 'none'; // 'dense' | 'tfidf'

// Pre-computed TF-IDF doc vectors (always available, no network needed)
let tfidfDocVectors = null;   // Map<docId, Map<term, weight>>
let idfMap = null;            // Map<term, idf>

// ─── Text processing ────────────────────────────────────────────────────────

/**
 * Tokenize text into TF-IDF weighted term vector with domain boosts.
 * @param {string} text
 * @returns {Map<string, number>} term → weight
 */
export function textToTerms(text) {
  if (!text || typeof text !== 'string') return new Map();

  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);

  // Raw term frequency
  const tf = new Map();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) || 0) + 1);
  }

  // Normalize by max frequency, apply domain boosts & IDF
  const maxFreq = Math.max(...tf.values(), 1);
  const weighted = new Map();

  for (const [term, count] of tf) {
    let weight = count / maxFreq;

    // Domain boost
    if (DOMAIN_BOOSTS[term]) {
      weight *= DOMAIN_BOOSTS[term];
    }

    // IDF (if computed)
    if (idfMap && idfMap.has(term)) {
      weight *= idfMap.get(term);
    }

    weighted.set(term, weight);
  }

  return weighted;
}

// ─── Vector math ────────────────────────────────────────────────────────────

/**
 * Cosine similarity between two sparse term vectors (Maps).
 * @param {Map<string, number>} a
 * @param {Map<string, number>} b
 * @returns {number} similarity in [0, 1]
 */
export function cosineSimilarity(a, b) {
  if (!a || !b || a.size === 0 || b.size === 0) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (const [term, wA] of a) {
    magA += wA * wA;
    if (b.has(term)) {
      dot += wA * b.get(term);
    }
  }
  for (const wB of b.values()) {
    magB += wB * wB;
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;
  return dot / denom;
}

/**
 * Cosine similarity between two dense vectors (Float64Arrays).
 * @param {Float64Array} a
 * @param {Float64Array} b
 * @returns {number}
 */
export function denseCosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  if (denom === 0) return 0;
  return dot / denom;
}

// ─── IDF + TF-IDF index ────────────────────────────────────────────────────

/**
 * Build the IDF map and per-document TF-IDF vectors from ALL_DOCS.
 * Called lazily on first retrieve() if not already built.
 */
export function buildTfidfIndex() {
  if (tfidfDocVectors) return; // already built

  const N = ALL_DOCS.length;
  const docTerms = new Map(); // docId → raw token set (for IDF)
  const docTfs = new Map();   // docId → Map<term, raw count>

  // Pass 1: gather raw term frequencies per doc
  for (const doc of ALL_DOCS) {
    const fullText = `${doc.title} ${doc.content}`;
    const tokens = fullText
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 1);

    const tf = new Map();
    const termSet = new Set();
    for (const t of tokens) {
      tf.set(t, (tf.get(t) || 0) + 1);
      termSet.add(t);
    }
    docTfs.set(doc.id, tf);
    docTerms.set(doc.id, termSet);
  }

  // Pass 2: compute IDF
  const dfMap = new Map(); // term → # docs containing it
  for (const termSet of docTerms.values()) {
    for (const term of termSet) {
      dfMap.set(term, (dfMap.get(term) || 0) + 1);
    }
  }
  idfMap = new Map();
  for (const [term, df] of dfMap) {
    idfMap.set(term, Math.log((N + 1) / (df + 1)) + 1); // smoothed IDF
  }

  // Pass 3: build TF-IDF vectors with domain boosts
  tfidfDocVectors = new Map();
  for (const doc of ALL_DOCS) {
    const tf = docTfs.get(doc.id);
    const maxFreq = Math.max(...tf.values(), 1);
    const vec = new Map();
    for (const [term, count] of tf) {
      let weight = (count / maxFreq) * (idfMap.get(term) || 1);
      if (DOMAIN_BOOSTS[term]) {
        weight *= DOMAIN_BOOSTS[term];
      }
      vec.set(term, weight);
    }
    tfidfDocVectors.set(doc.id, vec);
  }
}

// ─── Dense embeddings (Foundry) ─────────────────────────────────────────────

/**
 * Call the embedding endpoint for a batch of texts.
 * Uses text-embedding-3-small via GitHub Models / Foundry.
 * @param {string[]} texts
 * @returns {Promise<Float64Array[]>}
 */
async function fetchEmbeddings(texts) {
  const apiKey = process.env.GITHUB_TOKEN;
  const baseURL = 'https://models.inference.ai.azure.com';

  const response = await fetch(`${baseURL}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: texts,
      model: 'text-embedding-3-small',
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  return json.data.map((d) => new Float64Array(d.embedding));
}

/**
 * Lazy-initialize dense embeddings from Foundry (or fall back to TF-IDF).
 */
export async function ensureEmbeddings() {
  // Always build TF-IDF as baseline
  buildTfidfIndex();

  if (denseEmbeddings) {
    embeddingMethod = 'dense';
    return;
  }

  if (!process.env.GITHUB_TOKEN) {
    embeddingMethod = 'tfidf';
    return;
  }

  try {
    const texts = ALL_DOCS.map((d) => `${d.title}\n${d.content}`);
    const vectors = await fetchEmbeddings(texts);

    denseEmbeddings = new Map();
    for (let i = 0; i < ALL_DOCS.length; i++) {
      denseEmbeddings.set(ALL_DOCS[i].id, vectors[i]);
    }
    embeddingMethod = 'dense';
  } catch (err) {
    console.warn('Dense embeddings unavailable, using TF-IDF fallback:', err.message);
    embeddingMethod = 'tfidf';
  }
}

// ─── Retrieval ──────────────────────────────────────────────────────────────

/**
 * @typedef {object} RetrievalResult
 * @property {string} id
 * @property {string} category
 * @property {string} title
 * @property {string} content
 * @property {number} score
 */

/**
 * Semantic search over the knowledge base.
 *
 * @param {string} query - Natural language query
 * @param {number} [topK=3] - Maximum results to return
 * @param {number} [minScore=0.1] - Minimum similarity score
 * @returns {Promise<RetrievalResult[]>} Results sorted by relevance (descending)
 */
export async function retrieve(query, topK = 3, minScore = 0.1) {
  await ensureEmbeddings();

  let scored;

  if (embeddingMethod === 'dense' && denseEmbeddings) {
    // Dense retrieval
    const [queryVec] = await fetchEmbeddings([query]);
    scored = ALL_DOCS.map((doc) => ({
      ...doc,
      score: denseCosineSimilarity(queryVec, denseEmbeddings.get(doc.id)),
    }));
  } else {
    // TF-IDF fallback
    const queryVec = textToTerms(query);
    scored = ALL_DOCS.map((doc) => ({
      ...doc,
      score: cosineSimilarity(queryVec, tfidfDocVectors.get(doc.id)),
    }));
  }

  return scored
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

// ─── RAG-augmented chat ─────────────────────────────────────────────────────

let chatModel;

function getChatModel() {
  if (!chatModel) {
    chatModel = new ChatOpenAI({
      modelName: 'gpt-4o-mini',
      temperature: 0.3,
      configuration: {
        baseURL: 'https://models.inference.ai.azure.com',
        apiKey: process.env.GITHUB_TOKEN,
      },
    });
  }
  return chatModel;
}

/**
 * Full RAG pipeline: retrieve relevant docs → augment prompt → LLM call.
 *
 * @param {string} query - User question
 * @param {object} [context={}] - Additional context (e.g. from pipeline stages)
 * @param {string} [agent='synthesis'] - Agent role hint for system prompt
 * @param {number} [topK=3] - Number of knowledge docs to retrieve
 * @returns {Promise<{answer: string, sources: RetrievalResult[]}>}
 */
export async function ragAugmentedChat(query, context = {}, agent = 'synthesis', topK = 3) {
  const sources = await retrieve(query, topK);

  const knowledgeBlock = sources
    .map((s, i) => `[${i + 1}] ${s.title} (score: ${s.score.toFixed(3)})\n${s.content}`)
    .join('\n\n');

  const systemPrompt = `You are the ${agent} agent for CivicLens, a municipal infrastructure intelligence system for Lake Forest, IL.
Use the following knowledge base excerpts to inform your answer. Cite documents by number when relevant.
If the knowledge base doesn't cover the query, say so and answer with general knowledge.

--- KNOWLEDGE BASE ---
${knowledgeBlock}
--- END KNOWLEDGE BASE ---`;

  const contextStr = Object.keys(context).length
    ? `\nAdditional context: ${JSON.stringify(context)}`
    : '';

  const llm = getChatModel();
  const response = await llm.invoke([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `${query}${contextStr}` },
  ]);

  return {
    answer: response.content,
    sources,
  };
}

// ─── Status ─────────────────────────────────────────────────────────────────

/**
 * Returns status dict: document count, categories, embedding method, model route.
 * @returns {object}
 */
export function getRagStatus() {
  const categories = [...new Set(ALL_DOCS.map((d) => d.category))];
  return {
    document_count: ALL_DOCS.length,
    categories,
    category_count: categories.length,
    embedding_method: embeddingMethod,
    model_route: 'gpt-4o-mini',
    tfidf_ready: tfidfDocVectors !== null,
    dense_ready: denseEmbeddings !== null,
  };
}

// ─── Reset (for testing) ────────────────────────────────────────────────────

export function _resetState() {
  denseEmbeddings = null;
  embeddingMethod = 'none';
  tfidfDocVectors = null;
  idfMap = null;
  chatModel = null;
}
