/**
 * Extended data-integrity tests — validates MCP data files for completeness
 * and correct schema beyond what pipeline.test.js already covers.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'mcp-server', 'data');

function loadJSON(filename) {
  return JSON.parse(readFileSync(join(dataDir, filename), 'utf-8'));
}

describe('Data Integrity — service-requests.json', () => {
  let requests;
  it('loads without error', () => {
    requests = loadJSON('service-requests.json');
    assert.ok(Array.isArray(requests));
  });

  it('has at least 5 records', () => {
    assert.ok(requests.length >= 5, `Expected >= 5 service requests, got ${requests.length}`);
  });

  it('each record has id, category, status, description, address', () => {
    for (const r of requests) {
      assert.ok(r.id, `Missing id in record: ${JSON.stringify(r)}`);
      assert.ok(r.category, `Missing category in ${r.id}`);
      assert.ok(r.status, `Missing status in ${r.id}`);
      assert.ok(r.description, `Missing description in ${r.id}`);
      assert.ok(r.address || r.location, `Missing address/location in ${r.id}`);
    }
  });

  it('status values are valid', () => {
    const valid = ['open', 'in_progress', 'completed', 'resolved', 'closed'];
    for (const r of requests) {
      assert.ok(valid.includes(r.status), `Invalid status "${r.status}" in ${r.id}`);
    }
  });

  it('has unique ids', () => {
    const ids = requests.map(r => r.id);
    assert.equal(ids.length, new Set(ids).size, 'Duplicate IDs found');
  });
});

describe('Data Integrity — potholes.json', () => {
  let potholes;
  it('loads without error', () => {
    potholes = loadJSON('potholes.json');
    assert.ok(Array.isArray(potholes));
  });

  it('has at least 5 records', () => {
    assert.ok(potholes.length >= 5);
  });

  it('each record has id, severity, location', () => {
    for (const p of potholes) {
      assert.ok(p.id, `Missing id`);
      assert.ok(typeof p.severity === 'number', `Missing severity in ${p.id}`);
      assert.ok(p.location || p.address, `Missing location in ${p.id}`);
    }
  });

  it('severity values are in range 1-10', () => {
    for (const p of potholes) {
      assert.ok(p.severity >= 1 && p.severity <= 10, `Severity ${p.severity} out of range in ${p.id}`);
    }
  });

  it('near_school is boolean', () => {
    for (const p of potholes) {
      assert.equal(typeof p.near_school, 'boolean', `near_school not boolean in ${p.id}`);
    }
  });

  it('has unique ids', () => {
    const ids = potholes.map(p => p.id);
    assert.equal(ids.length, new Set(ids).size);
  });
});

describe('Data Integrity — sidewalk-issues.json', () => {
  let issues;
  it('loads without error', () => {
    issues = loadJSON('sidewalk-issues.json');
    assert.ok(Array.isArray(issues));
  });

  it('has at least 5 records', () => {
    assert.ok(issues.length >= 5);
  });

  it('each record has id, location, ada_compliant', () => {
    for (const s of issues) {
      assert.ok(s.id, `Missing id`);
      assert.ok(s.location || s.address, `Missing location in ${s.id}`);
      assert.equal(typeof s.ada_compliant, 'boolean', `ada_compliant not boolean in ${s.id}`);
    }
  });

  it('has unique ids', () => {
    const ids = issues.map(s => s.id);
    assert.equal(ids.length, new Set(ids).size);
  });
});

describe('Data Integrity — schools.json', () => {
  let schools;
  it('loads without error', () => {
    schools = loadJSON('schools.json');
    assert.ok(Array.isArray(schools));
  });

  it('has at least 3 schools', () => {
    assert.ok(schools.length >= 3);
  });

  it('each school has id, name, type, address', () => {
    for (const s of schools) {
      assert.ok(s.id || s.name, 'Missing identifier');
      assert.ok(s.name, `Missing name`);
      assert.ok(s.type || s.school_type, `Missing type`);
      assert.ok(s.address || s.location, `Missing address`);
    }
  });
});

describe('Data Integrity — work-orders.json', () => {
  let orders;
  it('loads without error', () => {
    orders = loadJSON('work-orders.json');
    assert.ok(Array.isArray(orders));
  });

  it('has at least 5 records', () => {
    assert.ok(orders.length >= 5);
  });

  it('each record has id, status, priority, estimated_cost', () => {
    for (const w of orders) {
      assert.ok(w.id, `Missing id`);
      assert.ok(w.status, `Missing status in ${w.id}`);
      assert.ok(w.priority, `Missing priority in ${w.id}`);
      assert.ok(typeof w.estimated_cost === 'number', `Missing estimated_cost in ${w.id}`);
    }
  });

  it('status values are valid', () => {
    const valid = ['open', 'in_progress', 'completed'];
    for (const w of orders) {
      assert.ok(valid.includes(w.status), `Invalid status "${w.status}" in ${w.id}`);
    }
  });

  it('priority values are valid', () => {
    const valid = ['critical', 'high', 'medium', 'low'];
    for (const w of orders) {
      assert.ok(valid.includes(w.priority), `Invalid priority "${w.priority}" in ${w.id}`);
    }
  });

  it('has unique ids', () => {
    const ids = orders.map(w => w.id);
    assert.equal(ids.length, new Set(ids).size);
  });
});
