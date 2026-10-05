# Runbook: order-status and returns agent (practice project)

By default everything runs in **mock mode** (fixed rules, not an LLM) with synthetic data. Cloud mode sends the synthetic messages to Groq; never use it with real customer data without a data agreement. The API key lives in `.env` (ignored by git and Docker) and is never used in CI. There is no live deployment; "deploy" means the `main` branch passing CI.

## 1. How to start it

Requirements: Node.js 22 or newer. No `npm install`, API key or cloud account.

```sh
npm run demo -- "Where is order A-1001?"   # one request; starts and stops a local demo API
npm test                                    # behaviour, access, failure and idempotency tests
npm run test:exercise                       # returnEligibility tests
npm run evaluate                            # 16 acceptance cases, mock mode
npm run demo:ai -- "Where is order A-1001?" # optional: local Ollama model (qwen3:4b) must be running
npm run demo:cloud -- "Where is order A-1001?" # optional: Groq cloud model, needs GROQ_API_KEY in .env
npm run evaluate:cloud                      # optional: all cases against the cloud model (about 1-2 minutes)
```

With Docker (runs the mock evaluation in a container and prints the report; verified locally on 2026-10-05: 16/16, exit code 0):

```sh
docker build -t zone01-fde-demo .
docker run --rm zone01-fde-demo
```

The container does not keep the report on the host; use `npm run evaluate` locally or the CI artifact for a saved copy.

## 2. Where the reports are

| Command | Report |
|---|---|
| `npm run demo` | `output/last-run.json` |
| `npm run evaluate` | `output/evaluation-mock.json` |
| `npm run evaluate -- --ollama` | `output/evaluation-live.json` |
| `npm run evaluate:cloud` | `output/evaluation-cloud.json` |
| GitHub CI (every push) | **Actions** tab → run → artifact `mock-evaluation` (kept 3 days) |

`output/` is not committed to git. A saved copy of the final mock evaluation is kept in `reports/evaluation-mock-17of17.json`, and of the live cloud run (after the refund decision) in `reports/evaluation-cloud-gpt-oss-120b-16of17.json`. Each result contains `outcome`, `requestId`, `toolCalls`, `latencyMs` and a `trace` of tool calls.

## 3. Which outcomes need a human

| Outcome | Meaning | Who acts |
|---|---|---|
| `answered` | Answer built from verified API data | Nobody |
| `needs_information` | Missing order ID, more than 3 orders, or unknown request | The customer replies |
| `handoff_created` | A ticket exists (ID such as `T-1`), confirmed by the API | Support team picks it up; refunds go to the accountant |
| `needs_human` | Could not verify: API down (e.g. 503), order unavailable, model unavailable, step or tool-call limit | **A person must act. No ticket was created.** |

Notes:
- `needs_human` is the dangerous one: the customer is waiting but nobody has been notified. In this demo it is only reported, not routed. Before a real pilot, every `needs_human` must reach a monitored queue or create a `support_review` ticket.
- Many `needs_human` results with `upstream` errors in a short time means a service is down: check the order API first. The trace currently hides the automatic retry (1 tool call can be 2 HTTP requests).
- Tickets and idempotency keys live in memory only; they disappear when the API process stops.

## 4. How to roll back

Every change goes through git and CI.

1. Find the bad commit: `git log --oneline`
2. Undo it with a new commit: `git revert <commit-id>`
3. Run `npm test && npm run test:exercise && npm run evaluate` locally, then `git push`
4. Confirm the CI run on the reverted commit is green.

Use `git revert`, not `git reset` + force push: revert keeps history, so everyone else's copy stays valid and the record shows what was undone and why.

**Kill switch (planned for the pilot, not built in this demo):** if a privacy or wrong-status error happens, switch the agent off and route all messages back to the support team, then investigate using the `requestId` and trace.

## 5. Who approves changes

| Type of change | Approves |
|---|---|
| Internal only (logging, traces, refactoring; customers see no difference) | Technical owner (Kostas): code review + green CI |
| Customer-facing behaviour (answer wording, limits, which requests get tickets) | Business owner (Maria), after the technical review |
| Return policy and exceptions | Maria and the senior agent (Nikos); the agent never decides these |
