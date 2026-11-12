#!/usr/bin/env node
/**
 * Runs the browser checks in tests/e2e/*.e2e.mjs against the production build.
 *
 *   npm run build && npm run e2e            # all files
 *   npm run e2e -- T-01                     # only files whose name contains "T-01"
 *
 * Each file default-exports `async function ({ openGame, setKey, wait, assert })` and throws (or
 * uses `assert`) on failure. One file per ticket: tests/e2e/T-XX-name.e2e.mjs, owned by the ticket.
 * FOUNDATION-OWNED runner: do not edit.
 */
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { root, setKey, startHarness, wait } from './lib/harness.mjs';

const dir = path.join(root, 'tests', 'e2e');
const filter = process.argv[2];
const files = readdirSync(dir)
  .filter((f) => f.endsWith('.e2e.mjs') && (!filter || f.includes(filter)))
  .sort();

if (files.length === 0) {
  console.log('e2e: no matching test files');
  process.exit(0);
}

let failed = 0;
let harness;
try {
  harness = await startHarness();
  for (const file of files) {
    const started = Date.now();
    try {
      const mod = await import(pathToFileURL(path.join(dir, file)).href);
      await mod.default({ openGame: harness.openGame, setKey, wait, assert });
      console.log(`  ok   ${file} (${Date.now() - started} ms)`);
    } catch (error) {
      failed++;
      console.error(`  FAIL ${file}\n       ${error instanceof Error ? error.message : error}`);
    }
  }
} catch (error) {
  failed++;
  console.error('e2e: crashed:', error instanceof Error ? error.message : error);
} finally {
  await harness?.stop();
}
console.log(failed ? `e2e: ${failed} FAILED` : 'e2e: OK');
process.exit(failed ? 1 : 0);
