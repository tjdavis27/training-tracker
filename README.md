# Florence Training Tracker v1.3.0

Shared training tracker for The Escape Room Florence.

## What changed in v1.3

### Quiz workflow
Quizzes now have three distinct stages:

1. **Not Taken**
2. **Submitted · Awaiting Grade**
3. **Passed** or **Retake Required**

A TM/trainer can mark a quiz as taken and record:
- Date taken
- Who was with the employee

They do **not** grade the quiz at submission time.

TJ can later open the employee's training file and click **Grade** on the submitted attempt to mark:
- Pass
- Fail

A failed attempt stays in history and the quiz becomes **Retake Required** until a later submitted attempt is graded Pass.

### Every CXS item is a quiz
CXS-1:
- Basics Quiz
- Policy Quiz
- Phone Call Quiz
- FAQ Quiz
- Escape Kit Quiz
- CXS-1 Test

CXS-2:
- Square Quiz
- Bookeo Quiz
- Policies / Troubleshooting Quiz
- CXS-2 Test

CXS-3:
- Invoices Quiz
- Emails Quiz
- Scarcity Blocks Quiz
- CXS-3 Test

### Updates
"Daily Update" / "Daily Journal" has been renamed to **Update / Training Updates**.

Updates can happen multiple times in one day or not at all for several days.

When adding an Update, the trainer can also check any quizzes that were taken during that training session. Those quizzes are automatically added as **Submitted · Awaiting Grade** using the Update's date and trainer.

## Existing seeded status
- TJ: everything completed
- Izzy: everything completed except CXS-3 Emails Quiz; the historical failed attempt remains Retake Required
- Jade: RH1 and BB fully cleared
- Lucie: active training file

Historical completion does not invent old observer names, scores, reset times, or feedback.

## Shared setup
If you already use Supabase from v1.2:

1. Open your Supabase project.
2. Open **SQL Editor**.
3. Run the new `supabase-schema.sql` once.
4. Upload the new app files to the same GitHub Pages repository.

The SQL is designed to preserve your existing employees, updates, observations, resets, and quiz history.

The key database change is that a quiz attempt may now exist without a grade until TJ grades it later.
