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
      // Every distinct order ID, not just the first one (the agent rejects more than 3 earlier).
      const ids = [...new Set(input.toUpperCase().match(/A-\d{3,4}/g) ?? [])];
      if (/refund|money back|\breturn\b|send (it )?back|επιστροφ[ήη]|επιστρεψ/i.test(input))
        // Refunds need an order ID first, so the ticket is usable for the accountant.
        return ids.length
          ? call('get_policy', {})
          : { role: 'assistant', content: 'Please provide the order ID for your refund.' };
      if (/human|άνθρωπο|ανθρωπο/i.test(input))
        return call('create_ticket', { reason: 'support_review' });
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
// Cloud LLM through Groq's OpenAI-compatible API (free tier). Messages leave this machine:
// fine for the synthetic demo data, not for real customer data without a data agreement.
// The key comes from the environment (.env, never committed) and is never logged.
// Model names change; list current ones with GET https://api.groq.com/openai/v1/models.
export const GROQ_DEFAULT_MODEL = 'openai/gpt-oss-120b';
export function groqModel(model = process.env.GROQ_MODEL || GROQ_DEFAULT_MODEL) {
  return async (messages, tools) => {
    const key = process.env.GROQ_API_KEY;
    if (!key) throw new Error('GROQ_API_KEY is not set');
    const body = JSON.stringify({
      model,
      messages: toOpenAiMessages(messages),
      tools,
      tool_choice: 'auto',
      temperature: 0,
    });
    // Free tier rate limits answer 429: wait and retry at most twice, then fail honestly.
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
        signal: AbortSignal.timeout(30000),
        body,
      });
      if (r.status === 429 && attempt < 2) {
        const waitSeconds = Math.min(Number(r.headers.get('retry-after')) || 5, 30);
        await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
        continue;
      }
      if (!r.ok) throw new Error('Groq request failed: ' + r.status);
      const message = (await r.json()).choices?.[0]?.message;
      if (!message) throw new Error('Missing model message');
      return { role: 'assistant', content: message.content ?? '', tool_calls: message.tool_calls };
    }
  };
}
// The agent stores tool results as { role: 'tool', tool_name, content }. OpenAI-style APIs need
// each result linked to its call by tool_call_id, in the order the calls were made.
function toOpenAiMessages(messages) {
  let pendingIds = [];
  return messages.map((m) => {
    if (m.role === 'assistant') {
      pendingIds = (m.tool_calls ?? []).map((c) => c.id);
      return m.tool_calls?.length
        ? { role: 'assistant', content: m.content || null, tool_calls: m.tool_calls }
        : { role: 'assistant', content: m.content ?? '' };
    }
    if (m.role === 'tool')
      return { role: 'tool', tool_call_id: pendingIds.shift(), content: m.content };
    return { role: m.role, content: m.content };
  });
}
// Picks the model from command-line flags and reports the mode honestly.
export function modelFromArgs(argv) {
  if (argv.includes('--cloud'))
    return {
      model: groqModel(),
      mode: 'cloud_llm',
      modelName: process.env.GROQ_MODEL || GROQ_DEFAULT_MODEL,
    };
  if (argv.includes('--ollama'))
    return { model: ollamaModel(), mode: 'local_llm', modelName: 'qwen3:4b' };
  return { model: mockModel(), mode: 'deterministic_mock_not_llm', modelName: 'mock' };
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
