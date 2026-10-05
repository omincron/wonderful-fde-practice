# Discovery brief

Υποθετικός πελάτης: μικρό e-shop με πολλά ερωτήματα για status παραγγελίας και επιστροφές.

Συμπλήρωσε έως μία σελίδα:

1. Ποιο συγκεκριμένο πρόβλημα λύνουμε και ποια βήματα κάνει σήμερα ο υπάλληλος;

   Customers send a message by email or chat about order status or a refund. Today the employee:
   - Finds the order number. Sometimes the customer doesn't include it, and the employee has to search or ask for it. The employee confirms that the sender's email matches the order's email.
   - For order status, checks the admin panel (processing, shipped, delivered). For shipped or delivered orders, they also check the courier's website, because the admin panel only syncs with the courier once a night and can disagree with it.
   - Replies to the customer using a template.
   - For a refund, checks that the 14-day return window hasn't passed, then opens a ticket for the accountant, who returns the money manually.

   The problem: even a simple status question takes 3–5 minutes. There are 150–200 requests a day, and over 300 on Mondays and after sales.

2. Ποιες πέντε ερωτήσεις θα έκανες σε business owner και τεχνική ομάδα πριν γράψεις κώδικα;

   1. How many order and return requests do you get per day, and how does that change on peak days?
   2. What steps does an employee take today when a request comes in?
   3. When the admin panel and the courier disagree, which one do you trust?
   4. How does the admin panel get courier data, and what can its API access (read-only or full access)?
   5. Which languages do customers write in, and which channel do they use more, chat or email?

3. Ποιο σύστημα είναι η πηγή αλήθειας για status και policy;

   The admin panel is the source of truth for order status and customer information. The 14-day return policy is a business rule owned by Maria and Nikos. For live tracking, the courier is the source of truth. The admin panel only syncs with the courier once a night, so a change during the day shows up in the admin panel only the next morning. This lag also affects returns: the delivery date in the admin panel can be off by up to a day, so a request near the 14-day limit can get the wrong result.

4. Πότε απαντά ο agent, πότε ζητά διευκρίνιση και πότε παραπέμπει σε άνθρωπο;

   - **Answers:** order status, but only for the customer's own order (the sender's email must match the order's email).
   - **Asks for clarification:** when the order number is missing. If the sender's email is verified, the agent can first look up the orders linked to it. Otherwise it asks for the order number.
   - **Hands off to a human:** refunds, complaints, faulty products, data conflicts and API failures. Outside working hours it tells the customer honestly when they will get a reply.

5. Τρία acceptance criteria: τι ακριβώς πρέπει να δείξει το demo;

   1. It never shows information about another customer's order.
   2. It never makes up a status when the API fails.
   3. It never claims a refund was made. It only confirms that a refund ticket was opened, with its ID.

6. Ποια baseline μέτρηση και ποιο αποτέλεσμα θα συνέκρινες σε πραγματικό pilot;

   Use the helpdesk export as the baseline, then run a 4-week pilot measuring:
   - **Resolution rate:** status questions answered with no handoff and no follow-up message about the same order within 48 hours.
   - **Response time:** median time to first answer, compared with the helpdesk export from before the pilot.
   - **Accuracy:** a person reviews a sample of about 30 conversations a week. The target is 0 privacy or wrong-status errors.

   If a wrong-status or privacy error happens, a kill switch turns the agent off and all messages go back to the team.

7. Out of scope for the pilot: issuing refunds, damaged items and complaints, voice, live courier calls (because of the 1,000 calls/day limit), and exceptions after day 14.

Τα δοσμένα orders και η πολιτική είναι φανταστικά. Μην παρουσιάσεις τα 12 συνθετικά cases ως αποδεδειγμένη εξοικονόμηση χρόνου σε πραγματική εταιρεία.
