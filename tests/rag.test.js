/**
 * Unit tests for the RAG Knowledge Base — TF-IDF retrieval, cosine similarity,
 * document integrity, and term processing
 */
import { strict as assert } from 'node:assert';
import { describe, it, before } from 'node:test';
import {
  KNOWLEDGE_DOCS,
  REQUIRED_CATEGORIES,
  textToTerms,
  cosineSimilarity,
  denseCosineSimilarity,
  buildTfidfIndex,
  retrieve,
} from '../rag/rag_knowledge_base.js';

describe('Knowledge Base Document Integrity', () => {

  it('contains exactly 11 documents', () => {
    assert.equal(KNOWLEDGE_DOCS.length, 11);
  });

  it('every document has id, category, title, and content', () => {
    for (const doc of KNOWLEDGE_DOCS) {
      assert.ok(doc.id, `Document missing id`);
      assert.ok(doc.category, `Document ${doc.id} missing category`);
      assert.ok(doc.title, `Document ${doc.id} missing title`);
      assert.ok(doc.content, `Document ${doc.id} missing content`);
      assert.ok(doc.content.length > 50, `Document ${doc.id} content too short`);
    }
  });

  it('covers all 6 required categories', () => {
    const categories = new Set(KNOWLEDGE_DOCS.map(d => d.category));
    for (const cat of REQUIRED_CATEGORIES) {
      assert.ok(categories.has(cat), `Missing required category: ${cat}`);
    }
  });

  it('has unique document IDs', () => {
    const ids = KNOWLEDGE_DOCS.map(d => d.id);
    const uniqueIds = new Set(ids);
    assert.equal(ids.length, uniqueIds.size, 'Duplicate document IDs found');
  });

  it('includes municipal code documents with section references', () => {
    const mcDocs = KNOWLEDGE_DOCS.filter(d => d.category === 'municipal_code');
    assert.ok(mcDocs.length >= 2, 'Should have at least 2 municipal code docs');
    assert.ok(mcDocs.some(d => d.content.includes('§7-3-1')), 'Should reference §7-3-1');
  });

  it('includes APWA repair standards', () => {
    const rsDocs = KNOWLEDGE_DOCS.filter(d => d.category === 'repair_standards');
    assert.ok(rsDocs.length >= 2, 'Should have at least 2 repair standards docs');
    assert.ok(rsDocs.some(d => d.content.includes('APWA')));
  });

  it('includes safety documents with school zone buffers', () => {
    const sfDocs = KNOWLEDGE_DOCS.filter(d => d.category === 'safety');
    assert.ok(sfDocs.some(d => d.content.includes('1,500 feet')));
  });

  it('includes ADA compliance requirements', () => {
    const adaDocs = KNOWLEDGE_DOCS.filter(d => d.content.includes('ADA'));
    assert.ok(adaDocs.length >= 2, 'Should reference ADA in multiple docs');
  });
});

describe('textToTerms', () => {

  it('tokenizes text into a Map of terms', () => {
    const terms = textToTerms('pothole repair on Main Street');
    assert.ok(terms instanceof Map);
    assert.ok(terms.has('pothole'));
    assert.ok(terms.has('repair'));
    assert.ok(terms.has('main'));
    assert.ok(terms.has('street'));
  });

  it('applies domain boosts to key infrastructure terms', () => {
    const terms = textToTerms('pothole sidewalk school');
    // Domain-boosted terms should have higher weights
    const potholeWeight = terms.get('pothole');
    assert.ok(potholeWeight > 1, `pothole weight ${potholeWeight} should be boosted (>1)`);
  });

  it('returns empty map for null or empty input', () => {
    assert.equal(textToTerms(null).size, 0);
    assert.equal(textToTerms('').size, 0);
    assert.equal(textToTerms(undefined).size, 0);
  });

  it('lowercases all terms', () => {
    const terms = textToTerms('POTHOLE Repair SCHOOL');
    assert.ok(terms.has('pothole'));
    assert.ok(terms.has('repair'));
    assert.ok(terms.has('school'));
    assert.ok(!terms.has('POTHOLE'));
  });

  it('strips special characters', () => {
    const terms = textToTerms('§7-3-1: pothole (repair)');
    assert.ok(terms.has('pothole'));
    assert.ok(terms.has('repair'));
    assert.ok(terms.has('7-3-1'));
  });

  it('filters out single-character tokens', () => {
    const terms = textToTerms('a b c pothole');
    assert.ok(!terms.has('a'));
    assert.ok(!terms.has('b'));
    assert.ok(terms.has('pothole'));
  });
});

describe('cosineSimilarity (sparse vectors)', () => {

  it('returns 1 for identical vectors', () => {
    const v = new Map([['pothole', 1], ['repair', 0.5]]);
    const sim = cosineSimilarity(v, v);
    assert.ok(Math.abs(sim - 1) < 0.001, `Expected ~1, got ${sim}`);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = new Map([['pothole', 1]]);
    const b = new Map([['sidewalk', 1]]);
    assert.equal(cosineSimilarity(a, b), 0);
  });

  it('returns value between 0 and 1 for partial overlap', () => {
    const a = new Map([['pothole', 1], ['repair', 1]]);
    const b = new Map([['pothole', 1], ['school', 1]]);
    const sim = cosineSimilarity(a, b);
    assert.ok(sim > 0, `Similarity ${sim} should be > 0`);
    assert.ok(sim < 1, `Similarity ${sim} should be < 1`);
  });

  it('returns 0 for empty vectors', () => {
    assert.equal(cosineSimilarity(new Map(), new Map()), 0);
    assert.equal(cosineSimilarity(null, new Map([['a', 1]])), 0);
    assert.equal(cosineSimilarity(new Map([['a', 1]]), null), 0);
  });
});

describe('denseCosineSimilarity', () => {

  it('returns 1 for identical vectors', () => {
    const v = new Float64Array([0.5, 0.5, 0.5]);
    const sim = denseCosineSimilarity(v, v);
    assert.ok(Math.abs(sim - 1) < 0.001);
  });

  it('returns 0 for orthogonal vectors', () => {
    const a = new Float64Array([1, 0, 0]);
    const b = new Float64Array([0, 1, 0]);
    const sim = denseCosineSimilarity(a, b);
    assert.ok(Math.abs(sim) < 0.001);
  });

  it('returns 0 for empty or null vectors', () => {
    assert.equal(denseCosineSimilarity(null, null), 0);
    assert.equal(denseCosineSimilarity(new Float64Array([]), new Float64Array([])), 0);
  });

  it('returns 0 for mismatched lengths', () => {
    const a = new Float64Array([1, 0]);
    const b = new Float64Array([1, 0, 0]);
    assert.equal(denseCosineSimilarity(a, b), 0);
  });

  it('handles negative values correctly', () => {
    const a = new Float64Array([1, 0, 0]);
    const b = new Float64Array([-1, 0, 0]);
    const sim = denseCosineSimilarity(a, b);
    assert.ok(Math.abs(sim + 1) < 0.001, `Expected ~-1, got ${sim}`);
  });
});

describe('TF-IDF Index', () => {

  before(() => { buildTfidfIndex(); });

  it('builds without error', () => {
    // If we got here, buildTfidfIndex() succeeded
    assert.ok(true);
  });

  it('calling buildTfidfIndex() twice is idempotent', () => {
    buildTfidfIndex();
    buildTfidfIndex();
    assert.ok(true); // no error
  });
});

describe('RAG Retrieval (TF-IDF mode, no API)', () => {

  it('retrieves relevant documents for "pothole repair" query', async () => {
    const results = await retrieve('pothole repair standards', 3, 0.01);
    assert.ok(results.length > 0, 'Should return at least one result');
    assert.ok(results[0].score > 0, 'Top result should have positive score');
    // Should include APWA repair standards
    assert.ok(results.some(r => r.category === 'repair_standards'), 'Should include repair standards');
  });

  it('retrieves school safety docs for "school zone" query', async () => {
    const results = await retrieve('school zone safety potholes', 3, 0.01);
    assert.ok(results.length > 0);
    assert.ok(results.some(r => r.category === 'safety'));
  });

  it('retrieves ADA docs for accessibility queries', async () => {
    const results = await retrieve('ADA sidewalk compliance requirements', 3, 0.01);
    assert.ok(results.length > 0);
    assert.ok(results.some(r => r.content.includes('ADA')));
  });

  it('retrieves budget docs for budget queries', async () => {
    const results = await retrieve('infrastructure budget allocation cost', 3, 0.01);
    assert.ok(results.length > 0);
    assert.ok(results.some(r => r.category === 'budget'));
  });

  it('retrieves crew management docs for dispatch queries', async () => {
    const results = await retrieve('crew dispatch scheduling deployment', 3, 0.01);
    assert.ok(results.length > 0);
    assert.ok(results.some(r => r.category === 'crew_management'));
  });

  it('returns results sorted by score descending', async () => {
    const results = await retrieve('pothole repair near school', 5, 0.01);
    for (let i = 1; i < results.length; i++) {
      assert.ok(results[i - 1].score >= results[i].score,
        `Results not sorted: ${results[i - 1].score} < ${results[i].score}`);
    }
  });

  it('respects topK limit', async () => {
    const results = await retrieve('infrastructure', 2, 0.01);
    assert.ok(results.length <= 2);
  });

  it('respects minScore threshold', async () => {
    const results = await retrieve('completely unrelated xyzzy foobar', 5, 0.9);
    // With very high threshold, should return few or no results
    for (const r of results) {
      assert.ok(r.score >= 0.9, `Score ${r.score} below minScore 0.9`);
    }
  });

  it('returns results with required fields', async () => {
    const results = await retrieve('pothole', 1, 0.01);
    assert.ok(results.length > 0);
    const r = results[0];
    assert.ok(r.id, 'Missing id');
    assert.ok(r.category, 'Missing category');
    assert.ok(r.title, 'Missing title');
    assert.ok(r.content, 'Missing content');
    assert.ok(typeof r.score === 'number', 'Missing numeric score');
  });
});
