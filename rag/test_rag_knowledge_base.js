/**
 * Tests for RAG Knowledge Base — CivicLens
 *
 * 25+ tests covering:
 *   - Knowledge base content validation (required fields, unique IDs, category coverage)
 *   - TF-IDF text processing and cosine similarity
 *   - Retrieval correctness (top-k, score ordering, min_score filtering, category matching)
 *   - Status reporting (getRagStatus shape and values)
 *
 * Run:  node rag/test_rag_knowledge_base.js
 */

import {
  KNOWLEDGE_DOCS,
  REQUIRED_CATEGORIES,
  textToTerms,
  cosineSimilarity,
  denseCosineSimilarity,
  buildTfidfIndex,
  retrieve,
  getRagStatus,
  _resetState,
} from './rag_knowledge_base.js';

// ─── Minimal test runner ────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function assertAlmostEqual(a, b, tol, message) {
  if (Math.abs(a - b) > tol) {
    throw new Error(`${message} — expected ≈${b}, got ${a} (tol=${tol})`);
  }
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✔ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  ✘ ${name}`);
    console.log(`    ${err.message}`);
  }
}

// ─── 1. Knowledge Base Content Validation ───────────────────────────────────

console.log('\n📚 Knowledge Base Content');

await test('has exactly 11 documents', () => {
  assert(KNOWLEDGE_DOCS.length === 11, `Expected 11, got ${KNOWLEDGE_DOCS.length}`);
});

await test('all documents have required fields', () => {
  const required = ['id', 'category', 'title', 'content'];
  for (const doc of KNOWLEDGE_DOCS) {
    for (const field of required) {
      assert(doc[field], `Document ${doc.id || '?'} missing field: ${field}`);
      assert(typeof doc[field] === 'string', `${doc.id}.${field} must be a string`);
      assert(doc[field].trim().length > 0, `${doc.id}.${field} must not be empty`);
    }
  }
});

await test('all document IDs are unique', () => {
  const ids = KNOWLEDGE_DOCS.map((d) => d.id);
  const uniqueIds = new Set(ids);
  assert(ids.length === uniqueIds.size, `Duplicate IDs found: ${ids.filter((id, i) => ids.indexOf(id) !== i)}`);
});

await test('covers all 6 required categories', () => {
  const docCategories = new Set(KNOWLEDGE_DOCS.map((d) => d.category));
  for (const cat of REQUIRED_CATEGORIES) {
    assert(docCategories.has(cat), `Missing required category: ${cat}`);
  }
});

await test('each category has at least 1 document', () => {
  for (const cat of REQUIRED_CATEGORIES) {
    const count = KNOWLEDGE_DOCS.filter((d) => d.category === cat).length;
    assert(count >= 1, `Category ${cat} has 0 documents`);
  }
});

await test('municipal_code has 3 documents', () => {
  const count = KNOWLEDGE_DOCS.filter((d) => d.category === 'municipal_code').length;
  assert(count === 3, `Expected 3, got ${count}`);
});

await test('IDs follow expected prefix pattern', () => {
  const prefixes = { municipal_code: 'mc', repair_standards: 'rs', safety: 'sf', weather: 'wi', budget: 'bp', crew_management: 'cr' };
  for (const doc of KNOWLEDGE_DOCS) {
    const expected = prefixes[doc.category];
    assert(doc.id.startsWith(expected + '-'), `${doc.id} should start with ${expected}-`);
  }
});

await test('content is substantial (>100 chars each)', () => {
  for (const doc of KNOWLEDGE_DOCS) {
    assert(doc.content.length > 100, `${doc.id} content too short: ${doc.content.length} chars`);
  }
});

// ─── 2. TF-IDF Text Processing ─────────────────────────────────────────────

console.log('\n🔤 TF-IDF Text Processing');

await test('textToTerms returns Map for valid input', () => {
  const result = textToTerms('pothole repair near school zone');
  assert(result instanceof Map, 'Expected a Map');
  assert(result.size > 0, 'Expected non-empty Map');
});

await test('textToTerms handles empty/null input', () => {
  assert(textToTerms('').size === 0, 'Empty string should return empty Map');
  assert(textToTerms(null).size === 0, 'null should return empty Map');
  assert(textToTerms(undefined).size === 0, 'undefined should return empty Map');
});

await test('domain-boosted terms have higher weights', () => {
  // "pothole" has boost 3.0, "condition" has no boost
  const terms = textToTerms('pothole condition');
  const potholeWeight = terms.get('pothole') || 0;
  const conditionWeight = terms.get('condition') || 0;
  assert(
    potholeWeight > conditionWeight,
    `pothole (${potholeWeight}) should weigh more than condition (${conditionWeight})`,
  );
});

await test('textToTerms lowercases and strips punctuation', () => {
  const terms = textToTerms('Pothole! REPAIR, Zone.');
  assert(terms.has('pothole'), 'Should lowercase Pothole');
  assert(terms.has('repair'), 'Should lowercase REPAIR');
  assert(terms.has('zone'), 'Should lowercase Zone');
  assert(!terms.has('Pothole!'), 'Should strip punctuation');
});

await test('single-character tokens are filtered out', () => {
  const terms = textToTerms('I a am an ok at it');
  assert(!terms.has('i'), 'Single char "i" should be filtered');
  assert(!terms.has('a'), 'Single char "a" should be filtered');
  assert(terms.has('am'), '"am" (2 chars) should remain');
});

// ─── 3. Cosine Similarity ───────────────────────────────────────────────────

console.log('\n📐 Cosine Similarity');

await test('identical sparse vectors → similarity 1.0', () => {
  const v = new Map([['pothole', 2], ['repair', 1]]);
  assertAlmostEqual(cosineSimilarity(v, v), 1.0, 0.0001, 'Identical vectors');
});

await test('orthogonal sparse vectors → similarity 0.0', () => {
  const a = new Map([['pothole', 1]]);
  const b = new Map([['sidewalk', 1]]);
  assertAlmostEqual(cosineSimilarity(a, b), 0.0, 0.0001, 'Orthogonal vectors');
});

await test('partial overlap sparse vectors → 0 < similarity < 1', () => {
  const a = new Map([['pothole', 1], ['repair', 1]]);
  const b = new Map([['repair', 1], ['sidewalk', 1]]);
  const sim = cosineSimilarity(a, b);
  assert(sim > 0 && sim < 1, `Expected 0 < sim < 1, got ${sim}`);
});

await test('empty sparse vector → similarity 0.0', () => {
  const v = new Map([['pothole', 1]]);
  const empty = new Map();
  assertAlmostEqual(cosineSimilarity(v, empty), 0.0, 0.0001, 'Empty vs non-empty');
  assertAlmostEqual(cosineSimilarity(empty, empty), 0.0, 0.0001, 'Empty vs empty');
});

await test('identical dense vectors → similarity 1.0', () => {
  const v = new Float64Array([1, 2, 3]);
  assertAlmostEqual(denseCosineSimilarity(v, v), 1.0, 0.0001, 'Identical dense');
});

await test('orthogonal dense vectors → similarity 0.0', () => {
  const a = new Float64Array([1, 0, 0]);
  const b = new Float64Array([0, 1, 0]);
  assertAlmostEqual(denseCosineSimilarity(a, b), 0.0, 0.0001, 'Orthogonal dense');
});

await test('null/mismatched dense vectors → similarity 0.0', () => {
  const v = new Float64Array([1, 2, 3]);
  assertAlmostEqual(denseCosineSimilarity(null, v), 0.0, 0.0001, 'null a');
  assertAlmostEqual(denseCosineSimilarity(v, null), 0.0, 0.0001, 'null b');
  assertAlmostEqual(
    denseCosineSimilarity(new Float64Array([1, 2]), new Float64Array([1, 2, 3])),
    0.0, 0.0001, 'Mismatched lengths',
  );
});

// ─── 4. TF-IDF Index & Retrieval ────────────────────────────────────────────

console.log('\n🔍 TF-IDF Index & Retrieval');

// Force TF-IDF mode (no network calls)
_resetState();
buildTfidfIndex();

await test('buildTfidfIndex creates vectors for all docs', () => {
  const status = getRagStatus();
  assert(status.tfidf_ready === true, 'TF-IDF should be ready');
});

await test('retrieve returns results for pothole query', async () => {
  _resetState();
  buildTfidfIndex();
  const results = await retrieve('pothole repair priority');
  assert(results.length > 0, 'Expected at least 1 result');
  assert(results[0].score > 0, 'Top result should have positive score');
});

await test('retrieve results are sorted descending by score', async () => {
  _resetState();
  buildTfidfIndex();
  const results = await retrieve('sidewalk ADA compliance repair', 5);
  for (let i = 1; i < results.length; i++) {
    assert(
      results[i].score <= results[i - 1].score,
      `Results not sorted: index ${i - 1} (${results[i - 1].score}) < index ${i} (${results[i].score})`,
    );
  }
});

await test('retrieve respects topK limit', async () => {
  _resetState();
  buildTfidfIndex();
  const results = await retrieve('infrastructure maintenance budget crew', 2);
  assert(results.length <= 2, `Expected <= 2, got ${results.length}`);
});

await test('retrieve respects minScore filter', async () => {
  _resetState();
  buildTfidfIndex();
  const highThreshold = 0.99;
  const results = await retrieve('pothole', 10, highThreshold);
  for (const r of results) {
    assert(r.score >= highThreshold, `Score ${r.score} below minScore ${highThreshold}`);
  }
});

await test('school safety query retrieves safety category docs', async () => {
  _resetState();
  buildTfidfIndex();
  const results = await retrieve('school zone safety buffer requirements', 5, 0.05);
  const categories = results.map((r) => r.category);
  assert(categories.includes('safety'), `Expected safety category in results: ${categories}`);
});

await test('budget query retrieves budget category docs', async () => {
  _resetState();
  buildTfidfIndex();
  const results = await retrieve('infrastructure budget procurement cost', 5, 0.05);
  const categories = results.map((r) => r.category);
  assert(categories.includes('budget'), `Expected budget category in results: ${categories}`);
});

await test('crew dispatch query retrieves crew_management doc', async () => {
  _resetState();
  buildTfidfIndex();
  const results = await retrieve('crew deployment dispatch school zone restrictions', 5, 0.05);
  const categories = results.map((r) => r.category);
  assert(categories.includes('crew_management'), `Expected crew_management in results: ${categories}`);
});

await test('completely unrelated query returns few or no results', async () => {
  _resetState();
  buildTfidfIndex();
  const results = await retrieve('quantum mechanics superconductor', 3, 0.3);
  assert(results.length === 0, `Expected 0 results for unrelated query, got ${results.length}`);
});

// ─── 5. Status Reporting ────────────────────────────────────────────────────

console.log('\n📊 Status Reporting');

await test('getRagStatus returns correct shape', () => {
  _resetState();
  buildTfidfIndex();
  const status = getRagStatus();
  assert(typeof status.document_count === 'number', 'document_count should be a number');
  assert(Array.isArray(status.categories), 'categories should be an array');
  assert(typeof status.category_count === 'number', 'category_count should be a number');
  assert(typeof status.embedding_method === 'string', 'embedding_method should be a string');
  assert(typeof status.model_route === 'string', 'model_route should be a string');
  assert(typeof status.tfidf_ready === 'boolean', 'tfidf_ready should be boolean');
  assert(typeof status.dense_ready === 'boolean', 'dense_ready should be boolean');
});

await test('getRagStatus reports correct document count', () => {
  const status = getRagStatus();
  assert(status.document_count === 11, `Expected 11, got ${status.document_count}`);
});

await test('getRagStatus reports 6 categories', () => {
  const status = getRagStatus();
  assert(status.category_count === 6, `Expected 6, got ${status.category_count}`);
});

await test('getRagStatus reflects TF-IDF readiness', () => {
  _resetState();
  let status = getRagStatus();
  assert(status.tfidf_ready === false, 'Should be false before buildTfidfIndex');
  buildTfidfIndex();
  status = getRagStatus();
  assert(status.tfidf_ready === true, 'Should be true after buildTfidfIndex');
});

await test('getRagStatus reports model route', () => {
  const status = getRagStatus();
  assert(status.model_route === 'gpt-4o-mini', `Expected gpt-4o-mini, got ${status.model_route}`);
});

// ─── Summary ────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (failures.length > 0) {
  console.log('\nFailed tests:');
  for (const f of failures) {
    console.log(`  ✘ ${f.name}: ${f.error}`);
  }
}
console.log();
process.exit(failed > 0 ? 1 : 0);
