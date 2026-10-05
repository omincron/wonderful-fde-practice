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
- Αποτελέσματα tests και evaluation, με σαφή ένδειξη mode.
  - All results are **mock mode** (`deterministic_mock_not_llm`); no live LLM run yet.
  - Evaluation: 12/12 at the start → 12/14 after adding my 2 cases → 15/15 after the fixes plus a limit case → 16/16 after my regression case. `npm test` 23/23, `npm run test:exercise` 7/7.
  - Of 16 cases: 5 answered, 4 reached a confirmed ticket (`handoff_created`), 4 `needs_human` (no ticket), 3 `needs_information`.
  - Success: "two order IDs" → `answered`, 2 tool calls, 2 ms. Failure: "upstream 503" → `needs_human`, 6 ms, 1 tool call in the trace but 2 real HTTP requests (hidden retry). Mock latencies are local and say nothing about real LLM speed.
- Μία αλλαγή που πρότεινε AI και χρειάστηκε δική σου διόρθωση.
  - AI widened the mock's refund keywords ("money back", "return") to make my case pass. Reviewing it, I saw that "return" also matches inside longer words; a test run confirmed false refund tickets: "My order A-1001 was returned to sender" created a `refund_review` ticket.
  - I fixed it with a word boundary (`\breturn\b`) and added a regression case; evaluation went to 16/16.
  - Limitation: "the courier said it will return to the depot" still matches. Keywords can't detect intent; in production that is the LLM's job, guarded by checks in code.
- Μία πρακτική βελτίωση για pilot, ποιος θα την εγκρίνει και πώς θα κάνεις rollback.
  - Improvement: record every HTTP attempt in the trace (e.g. `attempts: 2, lastStatus: 503`). Expected change: for "upstream 503" the report would show 2 attempts instead of looking like 1 call, so monitoring can tell "down" from "flaky" and count real calls against rate limits.
  - Approval: an internal logging change, so the technical owner (Kostas) approves it through code review and a green CI run. Customers see no difference, so the business owner (Maria) is informed, not asked.
  - Rollback: `git revert <commit>`, run the tests, push, and confirm CI is green (see `RUNBOOK.md`).

Demo 5 λεπτών: ανάγκη → αρχιτεκτονική → επιτυχημένο αίτημα → αποτυχία → evaluation → επόμενο βήμα.
