const call = (name, args) => ({
  role: 'assistant',
  content: '',
  tool_calls: [{ function: { name, arguments: args } }],
});
// Several tool calls in one step, like a real LLM asking for multiple orders at once.
const calls = (name, argsList) => ({
  role: 'assistant',
  content: '',
  tool_calls: argsList.map((args) => ({ function: { name, arguments: args } })),
});
export function mockModel() {
  // Deterministic simulator for learning and regression tests. This is NOT an LLM.
  return async (messages) => {
    const input = messages.find((m) => m.role === 'user').content;
    const results = messages.filter((m) => m.role === 'tool');
    if (!results.length) {
      // Keyword matching is a mock-only shortcut; a real LLM has to understand other phrasings itself.
      if (/refund|money back|\breturn\b|send (it )?back|επιστροφ[ήη]|επιστρεψ/i.test(input))
        return call('get_policy', {});
      if (/human|άνθρωπο|ανθρωπο/i.test(input))
        return call('create_ticket', { reason: 'support_review' });
      // Every distinct order ID, not just the first one (the agent rejects more than 3 earlier).
      const ids = [...new Set(input.toUpperCase().match(/A-\d{3,4}/g) ?? [])];
      if (ids.length)
        return calls(
          'get_order',
          ids.map((orderId) => ({ orderId })),
        );
      return { role: 'assistant', content: 'Please provide your order ID.' };
    }
    if (results.at(-1).tool_name === 'get_policy')
      return call('create_ticket', { reason: 'refund_review' });
    return { role: 'assistant', content: 'Done' };
  };
}
export function ollamaModel(model = 'qwen3:4b') {
  return async (messages, tools) => {
    const r = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({
        model,
        messages,
        tools,
        stream: false,
        think: false,
        options: { temperature: 0 },
      }),
    });
    if (!r.ok) throw new Error('Local Ollama request failed: ' + r.status);
    const data = await r.json();
    if (!data.message) throw new Error('Missing model message');
    return data.message;
  };
}
