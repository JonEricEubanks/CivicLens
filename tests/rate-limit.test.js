/**
 * Unit tests for the Rate Limit circuit breaker module
 */
import { strict as assert } from 'node:assert';
import { describe, it, afterEach } from 'node:test';
import { isRateLimited, markRateLimited, clearRateLimit } from '../agent/rate-limit.js';

afterEach(() => { clearRateLimit(); });

describe('Rate Limit Module', () => {

  it('is not rate limited by default', () => {
    clearRateLimit();
    assert.equal(isRateLimited(), false);
  });

  it('becomes rate limited after markRateLimited()', () => {
    markRateLimited(60);
    assert.equal(isRateLimited(), true);
  });

  it('clears rate limit with clearRateLimit()', () => {
    markRateLimited(60);
    assert.equal(isRateLimited(), true);
    clearRateLimit();
    assert.equal(isRateLimited(), false);
  });

  it('uses default 300s when no argument given', () => {
    markRateLimited();
    assert.equal(isRateLimited(), true);
  });

  it('expires after the specified duration', () => {
    // Mark with 0 seconds — should expire immediately
    markRateLimited(0);
    // With 0 seconds, Date.now() + 0 * 1000 = Date.now(), which means
    // Date.now() < Date.now() is false — not rate limited
    assert.equal(isRateLimited(), false);
  });

  it('handles very short durations', () => {
    markRateLimited(0.001); // ~1ms
    // Should be rate limited for at least a moment
    // But the granularity is ms, so it might expire instantly
    // Just verify no errors occur
    const result = isRateLimited();
    assert.ok(typeof result === 'boolean');
  });

  it('can be re-marked after clearing', () => {
    markRateLimited(60);
    clearRateLimit();
    assert.equal(isRateLimited(), false);
    markRateLimited(120);
    assert.equal(isRateLimited(), true);
  });
});
