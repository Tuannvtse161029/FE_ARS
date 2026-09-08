#!/usr/bin/env node
/**
 * run-all-tests.mjs — orchestrator for the full test pipeline.
 *
 * Sequentially runs unit → integration → coverage so a single failing
 * stage short-circuits the pipeline (no point continuing if unit tests
 * are red). Used by `npm run test:full` and CI.
 *
 * Honours the env knobs:
 *   - SKIP_UNIT / SKIP_INTEGRATION / SKIP_COVERAGE   — skip a stage
 *   - TEST_FAIL_FAST=0                                — keep going after
 *                                                      a failure (default
 *                                                      is fail-fast)
 */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, '..');

const failFast = process.env.TEST_FAIL_FAST !== '0';

const stages = [
  {
    name: 'unit',
    cmd: 'vitest',
    args: ['run', '--config', join(projectRoot, 'vitest.unit.config.ts')],
    enabled: !process.env.SKIP_UNIT,
  },
  {
    name: 'integration',
    cmd: 'vitest',
    args: ['run', '--config', join(projectRoot, 'vitest.integration.config.ts')],
    enabled: !process.env.SKIP_INTEGRATION,
  },
  {
    name: 'coverage',
    cmd: 'vitest',
    args: ['run', '--coverage', '--config', join(projectRoot, 'vitest.config.ts')],
    enabled: !process.env.SKIP_COVERAGE,
  },
];

const localBin = (cmd) => join(projectRoot, 'node_modules', '.bin', cmd);

let firstFailure = null;
for (const stage of stages) {
  if (!stage.enabled) {
    console.log(`\u23ED ${stage.name}: skipped`);
    continue;
  }
  console.log(`\n\u25B6 ${stage.name} tests starting…`);
  const start = Date.now();
  const res = spawnSync(localBin(stage.cmd), stage.args, {
    stdio: 'inherit',
    cwd: projectRoot,
    env: process.env,
  });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  if (res.status !== 0) {
    console.error(`\u274c ${stage.name} failed in ${elapsed}s (exit ${res.status}).`);
    if (!firstFailure) firstFailure = stage.name;
    if (failFast) break;
  } else {
    console.log(`\u2713 ${stage.name} passed in ${elapsed}s.`);
  }
}

if (firstFailure) {
  console.error(`\n\u274c Pipeline halted at: ${firstFailure}`);
  process.exit(1);
}
console.log('\n\u2713 All test stages passed.');
process.exit(0);
