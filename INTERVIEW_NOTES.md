# Interview notes

Γράψε σύντομα, με δικά σου λόγια:

- Το πρόβλημα του πελάτη και η μικρότερη χρήσιμη λύση.
  - The business owner's support team is overloaded with order-status and refund questions (150–200 a day, double on Mondays). The smallest useful solution: an agent answers order-status questions, while refunds and anything needing judgement still go to humans through a ticket.
- Τι υλοποίησες εσύ πάνω στον αρχικό κώδικα.
  - Discovery: ran a client role-play and wrote `CUSTOMER_BRIEF.md` (scope, source of truth, handoff rules, acceptance criteria, pilot metrics).
  - `returnEligibility`: I designed the order of the checks (status first, then validate days and policy); AI wrote the JavaScript. I compared it with the reference: ours is stricter (rejects 7.5 days and unknown statuses).
  - Designed a read-only `check_return_eligibility` tool (takes only `orderId`; facts come from the API; exceptions after day 14 go to a human).
  - Found that a message with two order IDs lost the second one, in the mock (`.match`) and in `agent.mjs` (`.find`), so it also affected real LLM mode. Wrote the cases; AI wrote the fix; I chose a hard limit of 3 orders per message.
  - Found and fixed false refund tickets from AI's keyword change (see below).
  - Live LLM: instead of Ollama (not enough RAM), added a cloud mode on Groq's free tier. AI wrote the adapter; I chose the provider, created the key and reviewed the live results.
  - Business decision from the first live run: a refund request without an order ID now asks for the ID first, so the accountant gets a ticket she can act on (see results below).
  - Honest note: the starter code was reformatted with Prettier (formatting only; tests still passed).
- Ποια δεδομένα χρειάζεται κάθε tool και ποιος ελέγχει την πρόσβαση.
  - `get_order` needs only an `orderId`. `get_policy` takes no arguments and returns the return policy (window in days). `create_ticket` needs only a `reason` (`refund_review` or `support_review`).
  - Facts come from the API, never from the model. The model only chooses the tool and its arguments; `tools.mjs` checks them against an allowlist before any network call.
  - Access is controlled by the API, not the prompt: the customer identity comes from the server token, and another customer's order (A-2001) returns 404, so the API doesn't even reveal that it exists.
- Τι κάνει η λύση όταν το API ή το model αποτύχει.
  - API failure (A-503): the order API returns 503. `callTool` retries the GET once, gets 503 again, and returns an error. The agent stops with `needs_human` and does not invent a status. No ticket is created.
  - Weakness I found: the retry is hidden. The trace shows `toolCalls: 1`, but the API received 2 HTTP requests. On-call engineers can't tell "down" from "flaky", and against a rate-limited API (e.g. courier, 1,000 calls/day) failures cost double.
- Πώς ξέρεις ότι δημιουργήθηκε ticket και γιατί δεν υπόσχεσαι refund.
  - Only the outcome `handoff_created` with a ticket ID (e.g. `T-1`) proves a ticket exists, because the API confirmed it. `needs_human` means a human is needed, not that one was notified.
  - We never promise a refund: the agent only queues a ticket, and refund approval is a human decision. The answer always says "No refund has been issued."
- Διαφορά deterministic workflow/mock από πραγματικό LLM tool calling.
  - The mock is fixed code (regex rules): the same input always gives the same tool choice. It isn't free of errors, though; it only handles the phrasings it was written for.
  - A real LLM chooses tools itself and can pick the wrong tool, send bad arguments or loop. The guardrails (allowlist, API checks, step limits, answers built from tool data) exist for that case.
  - Passing mock tests proves the plumbing works, not that a real LLM behaves well.
  - Seen in practice: the live model failed cases the mock passed (it didn't recognise `A-503` as an order ID), and one case passed in one run and failed in the next with the same model and temperature 0. A live evaluation needs several runs and a pass rate per case, not one number.
- Αποτελέσματα tests και evaluation, με σαφή ένδειξη mode.
  - **Mock mode** (`deterministic_mock_not_llm`): 12/12 at the start → 12/14 after adding my 2 cases → 15/15 after the fixes plus a limit case → 16/16 after my regression case → 17/17 after the refund decision. `npm test` 24/24, `npm run test:exercise` 7/7. CI runs mock mode only.
  - **Live mode** (`cloud_llm`, model `openai/gpt-oss-120b` on Groq, synthetic data only): first run **12/16**. All 4 failures were safe (no invented status, no fake ticket, no leaked data): the model asked for an order ID instead of calling a tool.
    - "Status A-503": the model didn't recognise a 3-digit order ID. Fix: the `get_order` description now shows the ID format (`A-503 or A-1001`). It now reaches the API and ends with `needs_human`.
    - Refund requests without an order ID: the model asked "which order?". I judged that better for the business than our test (a ticket the accountant can't use), so I changed the expected outcome to `needs_information`, with the reason written in `cases.mjs`, and added a "refund with order ID" case.
    - After the changes: **16/17**. The remaining failure, the cross-customer injection attempt, passed in the first run and failed in the second: the model refused before calling any tool. Safe, but it shows live results are not fully repeatable. I left the expected outcome unchanged.
  - Outcomes (17 cases): mock 5 answered, 2 confirmed tickets (`handoff_created`), 4 `needs_human`, 6 `needs_information`; live 5 answered, 2 tickets, 3 `needs_human`, 7 `needs_information`.
  - Success: "two order IDs" → `answered`, 2 tool calls, 2 ms mock / 1,840 ms live. Failure: "upstream 503" → `needs_human`, 1 tool call in the trace but 2 real HTTP requests (hidden retry); 276 ms live. Mock latencies are local and say nothing about real LLM speed; live latency was 300–2,600 ms per request.
  - Saved reports: `reports/evaluation-mock-17of17.json`, `reports/evaluation-cloud-gpt-oss-120b-16of17.json`.
- Μία αλλαγή που πρότεινε AI και χρειάστηκε δική σου διόρθωση.
  - AI widened the mock's refund keywords ("money back", "return") to make my case pass. Reviewing it, I saw that "return" also matches inside longer words; a test run confirmed false refund tickets: "My order A-1001 was returned to sender" created a `refund_review` ticket.
  - I fixed it with a word boundary (`\breturn\b`) and added a regression case; evaluation went to 16/16.
  - Limitation: "the courier said it will return to the depot" still matches. Keywords can't detect intent; in production that is the LLM's job, guarded by checks in code.
- Μία πρακτική βελτίωση για pilot, ποιος θα την εγκρίνει και πώς θα κάνεις rollback.
  - Improvement: record every HTTP attempt in the trace (e.g. `attempts: 2, lastStatus: 503`). Expected change: for "upstream 503" the report would show 2 attempts instead of looking like 1 call, so monitoring can tell "down" from "flaky" and count real calls against rate limits.
  - Approval: an internal logging change, so the technical owner (Kostas) approves it through code review and a green CI run. Customers see no difference, so the business owner (Maria) is informed, not asked.
  - Rollback: `git revert <commit>`, run the tests, push, and confirm CI is green (see `RUNBOOK.md`).
  - Next improvement found in the live run: refund tickets don't store the order ID yet. The model now asks for it, but `create_ticket` only keeps a `reason`, so the accountant still can't see which order the ticket is for.
  - Data and secrets: cloud mode sends messages to an external provider. Fine for synthetic data; with real customers it needs a data agreement first. The API key lives in `.env`, ignored by git and by Docker (`.dockerignore` had to be updated, or `COPY . .` would have put the key in the image).

Demo 5 λεπτών: ανάγκη → αρχιτεκτονική → επιτυχημένο αίτημα → αποτυχία → evaluation → επόμενο βήμα.
