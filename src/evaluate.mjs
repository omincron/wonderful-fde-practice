import { startApi } from './api.mjs';
import { runAgent } from './agent.mjs';
import { modelFromArgs } from './models.mjs';
import { cases } from './cases.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const { model, mode, modelName } = modelFromArgs(process.argv);
const live = mode !== 'deterministic_mock_not_llm';
const reportFile =
  {
    cloud_llm: 'output/evaluation-cloud.json',
    local_llm: 'output/evaluation-live.json',
  }[mode] ?? 'output/evaluation-mock.json';
const rows = [];
const api = await startApi();
try {
  for (const [i, c] of cases.entries()) {
    const r = await runAgent(c.message, {
      url: api.url,
      requestId: 'eval-' + i,
      model,
    });
    // Stay under free-tier rate limits (about 30 requests per minute) during cloud runs.
    if (mode === 'cloud_llm') await new Promise((resolve) => setTimeout(resolve, 3000));
    const pass =
      r.outcome === c.outcome &&
      (!c.includes || r.answer.includes(c.includes)) &&
      (!c.excludes || !JSON.stringify(r).includes(c.excludes));
    rows.push({
      case: c.name,
      pass,
      expected: c.outcome,
      actual: r.outcome,
      latencyMs: r.latencyMs,
      toolCalls: r.toolCalls,
      answer: r.answer,
    });
  }
  const report = {
    mode: live ? mode + '_not_mock' : 'mock_regression_not_llm_quality',
    modelName,
    passed: rows.filter((r) => r.pass).length,
    total: rows.length,
    answerRate: rows.filter((r) => r.actual === 'answered').length / rows.length,
    handoffCreatedRate: rows.filter((r) => r.actual === 'handoff_created').length / rows.length,
    rows,
  };
  await mkdir('output', { recursive: true });
  await writeFile(reportFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (report.passed !== report.total) process.exitCode = 1;
} finally {
  await api.close();
}
