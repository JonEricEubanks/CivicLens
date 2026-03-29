/**
 * End-to-end pipeline tests — runs the full 5-stage pipeline with all LLM
 * calls bypassed via rate limiting, verifying the entire fallback path.
 */
import { strict as assert } from 'node:assert';
import { describe, it, before, after, afterEach } from 'node:test';
import { markRateLimited, clearRateLimit } from '../agent/rate-limit.js';
import { runPipeline, getConversationMemory, clearConversationMemory } from '../agent/pipeline.js';
import { clearToolCache } from '../agent/data-agent.js';

// Force the entire pipeline into fallback / keyword mode
before(() => markRateLimited(600));
after(() => clearRateLimit());
afterEach(() => { clearToolCache(); clearConversationMemory(); });

describe('Pipeline E2E — help_guidance shortcut', () => {
  it('returns help markdown without calling MCP tools', async () => {
    const result = await runPipeline('How do I report an issue?', 'public');
    assert.ok(result.markdown, 'should return markdown');
    assert.ok(result.markdown.includes('Report'), 'should mention reporting');
    assert.equal(result.report_meta.data_coverage.sources_consulted, 0);
    assert.deepStrictEqual(result.actions_taken, []);
  });

  it('returns tracking help for track queries', async () => {
    const result = await runPipeline('How do I track my request?', 'public');
    assert.ok(result.markdown.includes('Track'));
  });

  it('returns generic help for vague help queries', async () => {
    const result = await runPipeline('help', 'public');
    assert.ok(result.markdown.includes('CivicLens'));
  });
});

describe('Pipeline E2E — priority_analysis fallback path', () => {
  it('runs all 5 stages and returns final report', async () => {
    const result = await runPipeline('What are the highest priority potholes?', 'public');
    assert.ok(result.markdown, 'should have markdown output');
    assert.ok(result.report_meta, 'should have report_meta');
    assert.ok(result.pipeline, 'should have pipeline metadata');
    assert.ok(result.pipeline.total_duration_ms > 0);
    assert.ok(result.pipeline.stages.length >= 3);
    assert.ok(Array.isArray(result.pipeline.agent_reasoning));
  });

  it('has trace with all expected stages', async () => {
    const result = await runPipeline('Show me open potholes in NW-3', 'public');
    assert.ok(result.trace, 'should have trace array');
    const stageNames = result.trace.map(t => t.stage);
    assert.ok(stageNames.includes('Intent Classification'));
    assert.ok(stageNames.includes('Data Retrieval'));
    assert.ok(stageNames.includes('Report Synthesis'));
    assert.ok(stageNames.includes('Report Formatting'));
  });
});

describe('Pipeline E2E — zone_summary', () => {
  it('routes zone queries to multi-source fetch', async () => {
    const result = await runPipeline('Summarize zone NW-3', 'public');
    assert.ok(result.markdown);
    assert.ok(result.report_meta);
  });
});

describe('Pipeline E2E — school_safety', () => {
  it('handles school safety queries', async () => {
    const result = await runPipeline('Are there any safety issues near schools?', 'public');
    assert.ok(result.markdown);
  });
});

describe('Pipeline E2E — conversation memory', () => {
  it('starts with empty memory after clear', () => {
    clearConversationMemory();
    assert.equal(getConversationMemory().length, 0);
  });

  it('accumulates memory across pipeline calls', async () => {
    clearConversationMemory();
    await runPipeline('help', 'public');
    assert.ok(getConversationMemory().length >= 2, 'should have user + assistant turns');
  });

  it('clearConversationMemory resets to empty', async () => {
    await runPipeline('help', 'public');
    clearConversationMemory();
    assert.equal(getConversationMemory().length, 0);
  });
});

describe('Pipeline E2E — streaming callback', () => {
  it('emits stage events when emit function provided', async () => {
    const events = [];
    const emit = (type, data) => events.push({ type, data });
    // Access the streaming version through the pipeline module
    const { runPipelineStreaming } = await import('../agent/pipeline.js');
    await runPipelineStreaming('help', emit, 'public');
    assert.ok(events.length > 0, 'should emit events');
    const stageEvents = events.filter(e => e.type === 'stage');
    assert.ok(stageEvents.length >= 4, 'should emit at least 4 stage events for help');
    const completeEvents = events.filter(e => e.type === 'complete');
    assert.equal(completeEvents.length, 1, 'should emit exactly one complete event');
  });
});
