# Wonderful FDE preparation starter

Εκπαιδευτικό project του Zone01 για APIs, tool calling, business rules, handoff και evaluation. Δεν είναι επίσημη άσκηση ή κώδικας της Wonderful.

## Εκκίνηση χωρίς συνδρομή

Χρειάζεσαι Node.js 22 ή νεότερη υποστηριζόμενη LTS έκδοση. Άνοιξε στο VS Code τον αποσυμπιεσμένο φάκελο που περιέχει package.json. Δεν απαιτούνται npm install, API key ή λογαριασμός cloud: χρησιμοποιούνται μόνο ενσωματωμένα modules του Node.

```sh
node --version
npm run demo -- "Where is order A-1001?"
npm run demo -- "I want a refund"
npm run demo -- "Status A-503"
npm test
npm run evaluate
```

Κάθε εντολή ξεκινά προσωρινό local HTTP API και το κλείνει όταν τελειώσει. Τα δεδομένα είναι συνθετικά. Οι παράγραφοι προς τον πελάτη στο demo είναι στα αγγλικά· μπορείς να προσθέσεις ελληνικές απαντήσεις ως επέκταση.

**Το default mode είναι deterministic mock, όχι πραγματικό LLM.** Προσομοιώνει επιλογή εργαλείων για να εξασκηθείς στον μηχανισμό και να έχεις επαναλήψιμα regression tests. Τα αποτελέσματά του δεν μετρούν την ποιότητα πραγματικού μοντέλου.

Το demo παράγει output/last-run.json. Το evaluation γράφει output/evaluation-mock.json με 12 cases, πραγματικά outcomes, χρόνους και tool calls. Το npm test τρέχει ελέγχους συμπεριφοράς, πρόσβασης, failures και idempotency. Τα αρχικά tests δεν περιλαμβάνουν την ημιτελή εκπαιδευτική άσκηση του επόμενου βήματος.

## Αρχιτεκτονική

Customer message → model adapter → bounded tool loop → local HTTP API → checked result → response or human handoff.

- src/api.mjs: τρεις παραγγελίες του demo customer, μία άλλου customer, πολιτική επιστροφών, τοπικά tickets. Το bearer token είναι επίτηδες demo-only και δεν προσφέρει production authentication.
- src/tools.mjs: allowlist εργαλείων, argument validation, timeout, μέχρι δύο GET attempts και idempotency key σε ticket writes.
- src/models.mjs: ξεχωριστό mock και προαιρετικός local Ollama adapter.
- src/agent.mjs: μέχρι έξι model steps και οκτώ tool calls. Τα facts της τελικής απάντησης προκύπτουν από tool results· το ελεύθερο κείμενο του μοντέλου δεν θεωρείται επιβεβαιωμένο γεγονός.
- src/cases.mjs: τα 12 acceptance scenarios. Πρόσθεσε δύο δικά σου.
- src/return-eligibility.mjs: η συνάρτηση που θα υλοποιήσεις.

Η API ταυτότητα δεν δίνεται από το μοντέλο. Η A-2001 ανήκει σε άλλο demo customer και δεν επιστρέφεται. Η A-503 δίνει σκόπιμα 503, για να παρακολουθήσεις δύο attempts και ειλικρινές fallback. needs_human σημαίνει ότι απαιτείται άνθρωπος, όχι ότι δημιουργήθηκε ticket. Μόνο handoff_created επιβεβαιώνει ότι το local API επέστρεψε ticket ID.

## Άσκηση business logic

Υλοποίησε returnEligibility(order, policy) στο src/return-eligibility.mjs. Πρέπει να επιστρέφει review_eligible έως και 14 ημέρες από την παράδοση, outside_window μετά το όριο, not_delivered πριν την παράδοση, invalid_data για ελλιπή ή μη έγκυρα δεδομένα. Eligibility σημαίνει δικαίωμα εξέτασης, όχι αυτόματη έγκριση χρημάτων.

```sh
npm run test:exercise
```

Η εντολή αρχικά αποτυγχάνει επειδή η συνάρτηση είναι σκόπιμα ημιτελής. Τα επτά tests περιλαμβάνουν το όριο των 14 ημερών, την επόμενη ημέρα, null, αρνητική τιμή και ελλιπή policy. Μετά τη δική σου προσπάθεια μπορείς να συγκρίνεις με reference/return-eligibility.mjs. Η συνάρτηση δεν είναι ακόμη συνδεδεμένη ως agent tool: σχεδίασε πού και με ποιον έλεγχο θα την ενσωμάτωνες. Η υλοποίηση όλου του νέου tool είναι προαιρετική επέκταση.

## Προαιρετικό πραγματικό τοπικό AI

Αν έχεις ήδη Ollama ή μπορείς να το εγκαταστήσεις χωρίς να χαθεί χρόνος, ακολούθησε https://docs.ollama.com/quickstart . Ξεκίνα την εφαρμογή ή, σε περιβάλλον όπου απαιτείται, ollama serve. Σε άλλο terminal:

```sh
ollama pull qwen3:4b
npm run demo:ai -- "Where is order A-1001?"
npm run evaluate -- --ollama
```

Το μοντέλο κατεβαίνει στον υπολογιστή σου και απαιτεί διαθέσιμη μνήμη και χώρο. Το download και η ταχύτητα εξαρτώνται από το μηχάνημα. Ο κώδικας καλεί μόνο http://127.0.0.1:11434 και δεν χρησιμοποιεί cloud API ή paid credits. Διάλεξε local model, όχι cloud μοντέλο. Αν η εγκατάσταση καθυστερήσει πάνω από 15 λεπτά, κράτησέ την ως επόμενο βήμα και ολοκλήρωσε το workshop σε mock mode.

Το live evaluation γράφει διαφορετικό αρχείο output/evaluation-live.json. Χρειάζεται και ανθρώπινο review: δες σωστή επιλογή εργαλείων, νόημα απάντησης και αποφυγή ατεκμηρίωτων ισχυρισμών. Σε αποτυχία μοντέλου το πρόγραμμα δηλώνει model_unavailable· δεν αλλάζει κρυφά σε mock. Ο Ollama adapter ακολουθεί την επίσημη τεκμηρίωση, αλλά πραγματικό model run δεν έχει επαληθευτεί κατά την προετοιμασία του πακέτου.

## Docker και CI

Προαιρετική εκτέλεση με διαθέσιμο Docker:

```sh
docker build -t zone01-fde-demo .
docker run --rm zone01-fde-demo
```

Το container τρέχει το mock evaluation και εμφανίζει το report στο terminal. Δεν κρατά report στον host από μόνο του. Στο GitHub, δημιούργησε ξεχωριστό εκπαιδευτικό repository και ανέβασε τα αρχεία μαζί με τον κρυφό φάκελο .github. Το workflow τρέχει npm test και mock evaluation και αποθηκεύει artifact. Δεν χρησιμοποιεί Ollama ή άλλο AI στο hosted CI. Όταν ολοκληρώσεις τη δική σου άσκηση, πρόσθεσε και npm run test:exercise στο workflow.

Για μηδενική χρέωση χρησιμοποίησε standard runner σε public repo μόνο με αυτά τα συνθετικά δεδομένα, ή private repo εντός του διαθέσιμου δωρεάν ορίου σου. Δεν χρειάζεται να ενεργοποιήσεις πληρωμές. Docker και hosted CI δεν εκτελέστηκαν κατά την προετοιμασία· επαλήθευσέ τα στο δικό σου περιβάλλον.

## Παραδοτέα δικής σου δουλειάς

Συμπλήρωσε CUSTOMER_BRIEF.md και INTERVIEW_NOTES.md. Υλοποίησε τη συνάρτηση eligibility, πρόσθεσε δύο evaluation cases και κράτησε το δικό σου report. Κατέγραψε τι άλλαξες και γιατί, πού σε βοήθησε AI, ένα failure που διερεύνησες και τι έτρεξες πραγματικά. Αν ολοκληρώσεις μόνο mock mode, παρουσίασέ το ακριβώς έτσι.

Production gaps για συζήτηση: πραγματική authentication/authorization, persistent ticket storage, concurrency, secrets, multilingual behaviour, πολύ περισσότερα tests, αναλυτικό monitoring και rollout/rollback. Τα tickets και η idempotency διατηρούνται μόνο όσο ζει το demo API process.
