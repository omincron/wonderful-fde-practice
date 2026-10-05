import test from 'node:test';
import assert from 'node:assert/strict';
import { startApi } from '../src/api.mjs';
import { runAgent } from '../src/agent.mjs';
import { mockModel, ollamaModel } from '../src/models.mjs';
import { callTool } from '../src/tools.mjs';
import { cases } from '../src/cases.mjs';
for (const c of cases)
  test(c.name, async () => {
    const api = await startApi();
    try {
      const r = await runAgent(c.message, { url: api.url, requestId: 'unit', model: mockModel() });
      assert.equal(r.outcome, c.outcome);
      if (c.includes) assert.ok(r.answer.includes(c.includes));
      if (c.excludes) assert.ok(!JSON.stringify(r).includes(c.excludes));
      if (c.name === 'upstream 503') assert.equal(api.stats.reads, 2);
    } finally {
      await api.close();
    }
  });
test('ticket retries with same ID do not duplicate writes', async () => {
  const api = await startApi();
  const ctx = { url: api.url, requestId: 'same-request' };
  try {
    const a = await callTool('create_ticket', { reason: 'support_review' }, ctx);
    const b = await callTool('create_ticket', { reason: 'support_review' }, ctx);
    assert.equal(a.ticketId, b.ticketId);
    assert.equal(api.stats.writes, 1);
  } finally {
    await api.close();
  }
});
test('missing bearer token is rejected by backend', async () => {
  const api = await startApi();
  try {
    assert.equal((await fetch(api.url + '/orders/A-1001')).status, 401);
  } finally {
    await api.close();
  }
});
test('model cannot call an arbitrary tool', async () => {
  const api = await startApi();
  try {
    const r = await runAgent('help', {
      url: api.url,
      requestId: 'bad-tool',
      model: async () => ({
        role: 'assistant',
        tool_calls: [{ function: { name: 'delete_all_orders', arguments: {} } }],
      }),
    });
    assert.equal(r.outcome, 'needs_human');
    assert.equal(api.stats.writes, 0);
  } finally {
    await api.close();
  }
});
test('invalid tool arguments never call the network', async () => {
  const r = await callTool(
    'get_order',
    { orderId: 'http://example.com' },
    { url: 'http://unused', requestId: 'bad' },
    () => {
      throw new Error('must not run');
    },
  );
  assert.equal(r.error, 'tool_or_arguments_not_allowed');
});
test('network failures use bounded read retries', async () => {
  let n = 0;
  const r = await callTool(
    'get_order',
    { orderId: 'A-1001' },
    { url: 'http://unused', requestId: 'timeout' },
    async () => {
      n++;
      throw new Error('timeout');
    },
  );
  assert.equal(n, 2);
  assert.equal(r.error, 'upstream_timeout_or_network');
});
test('model failure is disclosed rather than silently using mock', async () => {
  const r = await runAgent('hi', {
    url: 'http://unused',
    requestId: 'no-model',
    model: async () => {
      throw new Error('offline');
    },
  });
  assert.equal(r.outcome, 'needs_human');
  assert.ok(r.answer.includes('model is unavailable'));
});
test('repeated model tool calls stop at the loop limit', async () => {
  const api = await startApi();
  try {
    const r = await runAgent('help', {
      url: api.url,
      requestId: 'loop',
      model: async () => ({
        role: 'assistant',
        tool_calls: [{ function: { name: 'get_policy', arguments: {} } }],
      }),
    });
    assert.equal(r.outcome, 'needs_human');
    assert.ok(r.answer.includes('Step limit'));
    assert.equal(r.toolCalls, 6);
  } finally {
    await api.close();
  }
});
