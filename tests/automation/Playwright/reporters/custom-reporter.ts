/**
 * Custom Playwright reporter — generates:
 *
 *   test/report/<run-id>/SUMMARY.md   — human-readable run summary
 *   test/report/<run-id>/results.json  — machine-readable results
 *
 * The reporter implements the Playwright `Reporter` interface.
 * It hooks into `onTestEnd` to accumulate per-test results and
 * `onEnd` to write the output files. No test data is sent to any
 * external service.
 */
import type {
  Reporter,
  FullConfig,
  Suite,
  TestCase,
  TestResult,
  FullResult,
} from '@playwright/test/reporter';
import fs from 'node:fs';
import path from 'node:path';

interface TestRecord {
  title: string;
  role: string;
  feature: string;
  result: 'PASSED' | 'FAILED' | 'BLOCKED' | 'SKIPPED';
  attempts: number;
  baseUrl: string;
  stepsCompleted: string[];
  evidenceFiles: string[];
  expectedResult: string;
  actualResult: string;
  failureMessage: string;
  likelyCause: string;
  confidence: 'Low' | 'Medium' | 'High';
  recommendedOwner: 'Frontend' | 'Backend' | 'Test data' | 'Product decision';
  durationMs: number;
}

interface ReporterOptions {
  outputDir: string;
}

export class CustomReporter implements Reporter {
  private outputDir: string = '';
  private records: TestRecord[] = [];
  private runId: string = '';
  private baseUrl: string = '';

  constructor(options: ReporterOptions) {
    this.outputDir = options.outputDir ?? './test-report';
  }

  onBegin(_config: FullConfig, suite: Suite): void {
    this.runId = process.env.PW_RUN_ID ?? new Date().toISOString().replace(/[:.]/g, '-');
    this.baseUrl = process.env.E2E_BASE_URL ?? 'unknown';
    // Write metadata immediately so the folder exists for evidence captures.
    fs.mkdirSync(this.outputDir, { recursive: true });
    fs.writeFileSync(
      path.join(this.outputDir, '_metadata.json'),
      JSON.stringify(
        {
          runId: this.runId,
          baseUrl: this.baseUrl,
          startedAt: new Date().toISOString(),
          projectName: suite.project().name,
          configFile: suite.project().config?.configFile,
          playwrightVersion: _config.version,
        },
        null,
        2,
      ),
    );
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    // Extract metadata from test annotations / tags.
    const annotations = test.annotations ?? [];
    const getAnnotation = (type: string) =>
      annotations.find((a) => a.type === type)?.description ?? '';

    const role = getAnnotation('role') || test.title.split(' ')[0] || 'unknown';
    const feature = getAnnotation('feature') || test.title;
    const expected = getAnnotation('expected') || 'No annotation';
    const owner = (getAnnotation('owner') ?? 'Frontend') as
      | 'Frontend'
      | 'Backend'
      | 'Test data'
      | 'Product decision';
    const confidence = (getAnnotation('confidence') ?? 'Medium') as
      | 'Low'
      | 'Medium'
      | 'High';

    const status = result.status;
    let result_: TestRecord['result'];
    switch (status) {
      case 'passed':
        result_ = 'PASSED';
        break;
      case 'skipped':
        result_ = 'SKIPPED';
        break;
      case 'failed':
        result_ = 'FAILED';
        break;
      default:
        result_ = 'BLOCKED';
    }

    // Build the evidence file list from the run folder.
    const evidenceFiles: string[] = [];
    const runDir = this.outputDir;
    if (fs.existsSync(runDir)) {
      const files = fs.readdirSync(runDir);
      const safeLabel = test.title.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 48);
      for (const f of files) {
        if (f.includes(safeLabel) && f.endsWith('.png')) {
          evidenceFiles.push(f);
        }
      }
    }

    const stepsCompleted: string[] = [];
    for (const step of result.steps) {
      if (step.title) {
        stepsCompleted.push(step.title);
      }
    }

    const errorMsg = result.errors.length > 0
      ? result.errors.map((e) => e.message).join('\n')
      : '';

    // Hypothesis: classify the failure based on error message patterns.
    let likelyCause = 'Unclassified — manual triage required.';
    if (errorMsg.includes('403') || errorMsg.includes('401')) {
      likelyCause = 'Backend hypothesis: authorization error — check role claim and backend enforcement.';
    } else if (errorMsg.includes('404')) {
      likelyCause = 'Backend hypothesis: endpoint not found — verify route exists in Swagger.';
    } else if (errorMsg.includes('500')) {
      likelyCause = 'Backend hypothesis: server error — check backend logs.';
    } else if (errorMsg.includes('redirected to /login')) {
      likelyCause = 'Frontend hypothesis: authentication guard failed — token may be expired.';
    } else if (errorMsg.includes('redirected to /subscription')) {
      likelyCause = 'Frontend hypothesis: subscription gate triggered — check subscription status.';
    } else if (errorMsg.includes('Missing env var')) {
      likelyCause = 'Test-data hypothesis: credentials not configured in .env.playwright.local.';
    } else if (errorMsg.includes('E2E_BASE_URL')) {
      likelyCause = 'Test-data hypothesis: E2E_BASE_URL not set — runner blocked.';
    }

    // BLOCKED tests: if the error is about missing env vars or BASE_URL, flag it.
    if (
      result_ === 'FAILED' &&
      (errorMsg.includes('Missing env var') || errorMsg.includes('E2E_BASE_URL'))
    ) {
      result_ = 'BLOCKED';
    }

    this.records.push({
      title: test.title,
      role,
      feature,
      result: result_,
      attempts: result.attempts,
      baseUrl: this.baseUrl,
      stepsCompleted,
      evidenceFiles,
      expectedResult: expected,
      actualResult: errorMsg || `Test completed with status: ${status}`,
      failureMessage: errorMsg,
      likelyCause,
      confidence,
      recommendedOwner: owner,
      durationMs: result.duration,
    });
  }

  onEnd(result: FullResult): void {
    const endedAt = new Date().toISOString();
    const passed = this.records.filter((r) => r.result === 'PASSED').length;
    const failed = this.records.filter((r) => r.result === 'FAILED').length;
    const blocked = this.records.filter((r) => r.result === 'BLOCKED').length;
    const skipped = this.records.filter((r) => r.result === 'SKIPPED').length;
    const total = this.records.length;

    // ── SUMMARY.md ────────────────────────────────────────────────────────
    let md = `# ARS Role-Function Automation — Run Report\n\n`;
    md += `**Run ID:** \`${this.runId}\`  \n`;
    md += `**Base URL:** ${this.baseUrl}  \n`;
    md += `**Started:** ${fs.existsSync(path.join(this.outputDir, '_metadata.json')) ? JSON.parse(fs.readFileSync(path.join(this.outputDir, '_metadata.json'), 'utf8')).startedAt : 'unknown'}  \n`;
    md += `**Completed:** ${endedAt}  \n\n`;
    md += `| Result | Count |\n|---|---|\n`;
    md += `| PASSED | ${passed} |\n`;
    md += `| FAILED | ${failed} |\n`;
    md += `| BLOCKED | ${blocked} |\n`;
    md += `| SKIPPED | ${skipped} |\n`;
    md += `| **Total** | **${total}** |\n\n`;

    md += `## Failed / Blocked Tests\n\n`;
    md += `| Test | Role | Owner | Confidence | Likely Cause |\n`;
    md += `|---|---|---|---|---|\n`;
    for (const r of this.records.filter(
      (r) => r.result === 'FAILED' || r.result === 'BLOCKED',
    )) {
      md += `| ${r.title} | ${r.role} | ${r.recommendedOwner} | ${r.confidence} | ${r.likelyCause} |\n`;
    }

    md += `\n## All Tests\n\n`;
    md += `| Test | Role | Feature | Result | Attempts |\n`;
    md += `|---|---|---|---|---|\n`;
    for (const r of this.records) {
      md += `| ${r.title} | ${r.role} | ${r.feature} | **${r.result}** | ${r.attempts} |\n`;
    }

    // ── results.json ─────────────────────────────────────────────────────
    const json = {
      runId: this.runId,
      baseUrl: this.baseUrl,
      endedAt,
      summary: { passed, failed, blocked, skipped, total },
      records: this.records,
    };

    fs.writeFileSync(
      path.join(this.outputDir, 'SUMMARY.md'),
      md,
      'utf8',
    );
    fs.writeFileSync(
      path.join(this.outputDir, 'results.json'),
      JSON.stringify(json, null, 2),
      'utf8',
    );
  }
}