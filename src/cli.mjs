import { startApi } from './api.mjs';
import { runAgent } from './agent.mjs';
import { mockModel, ollamaModel } from './models.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
const ai = process.argv.includes('--ollama');
const message =
  process.argv
    .slice(2)
    .filter((x) => x !== '--ollama')
    .join(' ') || 'Where is order A-1001?';
const api = await startApi();
try {
  const result = await runAgent(message, {
    url: api.url,
    requestId: 'demo-' + Date.now(),
    model: ai ? ollamaModel() : mockModel(),
  });
  const out = { mode: ai ? 'local_llm' : 'deterministic_mock_not_llm', ...result };
  console.log(JSON.stringify(out, null, 2));
  await mkdir('output', { recursive: true });
  await writeFile('output/last-run.json', JSON.stringify(out, null, 2));
} finally {
  await api.close();
}
