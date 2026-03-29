/**
 * Icon integrity tests for CivicLens
 * Validates that all CivicIcons referenced in frontend files exist in icons.js
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('CivicIcons integrity', () => {
  it('icons.js exports all icon functions used in frontend', async () => {
    // Read icons.js source
    const iconsSource = await readFile(join(__dirname, '..', 'public', 'icons.js'), 'utf-8');

    // Extract all defined icon names from ICONS object
    const definedIcons = new Set();
    const defRegex = /^\s*(\w+)\s*:/gm;
    let match;
    while ((match = defRegex.exec(iconsSource)) !== null) {
      if (match[1] !== 'const' && match[1] !== 'window') {
        definedIcons.add(match[1]);
      }
    }

    // Read all frontend files that use CivicIcons
    const frontendFiles = [
      'public/index.html',
      'public/civic-map.js',
      'public/nlp-dashboard.js',
      'public/service-portal.js',
      'public/report-generator.js',
    ];

    const usedIcons = new Set();
    for (const file of frontendFiles) {
      const content = await readFile(join(__dirname, '..', file), 'utf-8');
      const useRegex = /CivicIcons\.(\w+)\s*\(/g;
      while ((match = useRegex.exec(content)) !== null) {
        usedIcons.add(match[1]);
      }
    }

    // Verify every used icon is defined
    const missing = [...usedIcons].filter(name => !definedIcons.has(name));
    assert.deepStrictEqual(missing, [], `Missing icon definitions: ${missing.join(', ')}`);
  });

  it('all icon functions return valid SVG strings', async () => {
    const iconsSource = await readFile(join(__dirname, '..', 'public', 'icons.js'), 'utf-8');

    // Extract icon names
    const defRegex = /^\s*(\w+)\s*:\s*\(/gm;
    const iconNames = [];
    let match;
    while ((match = defRegex.exec(iconsSource)) !== null) {
      iconNames.push(match[1]);
    }

    assert.ok(iconNames.length >= 40, `Expected at least 40 icons, got ${iconNames.length}`);

    // Each icon definition should contain <svg (search source text directly)
    for (const name of iconNames) {
      // Find the icon definition and check its template contains <svg
      const idx = iconsSource.indexOf(name + ':');
      assert.ok(idx !== -1, `Icon "${name}" should have a definition in icons.js`);
      // Look ahead up to 500 chars for the <svg tag within the template literal
      const snippet = iconsSource.slice(idx, idx + 500);
      assert.ok(snippet.includes('<svg'), `Icon "${name}" should contain an <svg tag`);
    }
  });

  it('icons.js is exposed as window.CivicIcons', async () => {
    const iconsSource = await readFile(join(__dirname, '..', 'public', 'icons.js'), 'utf-8');
    assert.ok(iconsSource.includes('window.CivicIcons'), 'icons.js must expose CivicIcons on window');
  });
});
