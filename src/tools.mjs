export const tools = [
  {
    type: 'function',
    function: {
      name: 'get_order',
      description:
        'Get the authenticated demo customer order. Ask for an ID if absent. Never invent an ID.',
      parameters: {
        type: 'object',
        properties: { orderId: { type: 'string' } },
        required: ['orderId'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_policy',
      description: 'Read the current returns policy.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_ticket',
      description: 'Queue a request for a human. This never issues a refund.',
      parameters: {
        type: 'object',
        properties: { reason: { type: 'string', enum: ['refund_review', 'support_review'] } },
        required: ['reason'],
        additionalProperties: false,
      },
    },
  },
];
export async function callTool(name, args, { url, requestId }, fetcher = fetch) {
  let path,
    method = 'GET',
    body;
  if (!args || typeof args !== 'object' || Array.isArray(args))
    return { error: 'invalid_arguments' };
  const keys = Object.keys(args);
  if (
    name === 'get_order' &&
    keys.length === 1 &&
    keys[0] === 'orderId' &&
    /^A-\d{3,4}$/.test(args.orderId)
  )
    path = '/orders/' + args.orderId;
  else if (name === 'get_policy' && keys.length === 0) path = '/policy/returns';
  else if (
    name === 'create_ticket' &&
    keys.length === 1 &&
    keys[0] === 'reason' &&
    ['refund_review', 'support_review'].includes(args.reason)
  ) {
    path = '/tickets';
    method = 'POST';
    body = JSON.stringify(args);
  } else return { error: 'tool_or_arguments_not_allowed' };
  // Only GET is retried. Writes carry an idempotency key and are not blindly retried.
  for (let attempt = 0; attempt < (method === 'GET' ? 2 : 1); attempt++) {
    try {
      const r = await fetcher(url + path, {
        method,
        body,
        headers: {
          authorization: 'Bearer demo-only-token',
          'content-type': 'application/json',
          'idempotency-key': requestId + ':ticket',
        },
        signal: AbortSignal.timeout(2000),
      });
      if (r.status >= 500 && method === 'GET' && attempt === 0) continue;
      const data = await r.json();
      return r.ok ? data : { error: data.error || 'upstream_error', status: r.status };
    } catch {
      if (method === 'GET' && attempt === 0) continue;
      return { error: 'upstream_timeout_or_network' };
    }
  }
}
