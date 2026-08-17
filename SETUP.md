# Mock Board — Upload, Browse, Pick, Vote, Results (the new SBAR board)

Replaces the paste-text Google Form with a full flow students run from their
laptops, inside the lab site they already have open:

1. **Upload** their finished MFR document (PDF/Word) — no login.
2. **Browse** everyone's submissions — *locked until they've submitted their own*.
3. **You pick finalists** from a console — read them, choose, Publish.
4. **Vote** — the class scores your finalists, each document embedded to read,
   on the exact Round 5 rubric (Sounds human · Source-anchored · Restrained ·
   AR 25-50 + BLUF · Compelling · No PII → /30).
5. **Results** — live tally on the projector; you crown the winner, reveal authors.

You run the whole thing from **`console.html`** and never touch code.

## Files (all in this `voting/` folder)

| File | Who opens it | Role |
|------|--------------|------|
| `console.html` | **You** | The control surface: live counts, launch buttons, student link, **Clear** |
| `upload.html` | Student | Submit a document (replaces the Form) |
| `browse.html` | Student / You | Browse submissions (gated; `?instructor=1` bypass for you) |
| `pick.html` | **You** | Read all submissions, pick finalists, Publish |
| `vote.html` | Student | Score finalists with the rubric, documents embedded |
| `results.html` | **You** | Live tally on the projector |
| `Code.gs` | — | The Google Apps Script backend (one endpoint, no student login) |

## One-time backend setup (~5 min, you only do this once)

1. Go to **https://script.new**, signed in as the account that should **own the
   files** — a **personal Gmail is safest** (Baylor/.mil Workspaces often block the
   "Anyone" access that no-login uploads need).
2. Delete the stub, paste **all of `Code.gs`**, Save.
3. **Run ▸ `onceInit`** and authorize when prompted. This creates two things in
   that Google account:
   - a Drive folder **"Mock Board Submissions"** (every uploaded MFR lands here —
     this is your "see all the files in one place"), and
   - a spreadsheet **"Mock Board Data"** (ballots + finalists).
4. **Deploy ▸ New deployment ▸ Web app**
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**
   - Deploy, copy the **`/exec` URL**.
5. Paste that URL into `CONFIG.endpoint` in **all six** HTML files
   (`console`, `upload`, `browse`, `pick`, `vote`, `results`). Same URL in each.
6. In `console.html`, also set `CONFIG.voteUrl` to the public URL students will
   click to vote (the hosted `vote.html`).

> Changed `Code.gs` later? In Apps Script do **Deploy ▸ Manage deployments ▸
> (edit) ▸ New version** so the live URL picks up your edits.

## Each class — the only thing you change

In every page's `CONFIG`, set `round` to a label for this cohort, e.g.
`"Campbell Jul26"`. It keeps each delivery's submissions, finalists, and ballots
separate. (Or just reuse the current label and hit **Clear** between classes — below.)

> **⚠ Never use a label Google Sheets can read as a date.** The backend writes the
> round into a sheet cell, and Sheets silently converts anything date-shaped into a
> real date — `"Aug 2026"` becomes `2026-08-01`, `"Aug26"` becomes `2026-08-26`.
> The pages then filter on the literal string and match nothing, so **uploads appear
> to succeed but never show up in browse, pick, console, or results**, and Clear
> can't remove them either. Always include a non-date word:
> `"Aug 2026 Cohort"` ✓ · `"Campbell Aug26"` ✓ · `"Aug 2026"` ✗ · `"Aug26"` ✗.
>
> Verify after changing it: load `console.html` and upload one test file — if the
> Submissions counter moves, the label is safe. If it stays at 0, the label was
> coerced; pick a different one.

## Running the board (all from `console.html`)

1. Students open the lab site → **Upload** their MFR. Watch **Submissions** climb.
2. On the break, hit **Review submissions** (or open the Drive folder) and read them.
3. **Pick & publish finalists** → choose the ones you want (they number in the
   order you pick), **Publish**. The vote page goes live the instant you publish.
4. Post / project the **Student voting link** (Copy button on the console).
5. **Project live results.** Reveal authors after the vote.

## Clear for the next class

The console's **⟲ Clear board** button (double-confirms) wipes **all submissions,
finalists, and ballots for the current round** — Drive files are trashed, sheet
rows removed. Use it only between classes. (Prefer to keep history? Change `round`
to a new label each cohort instead of clearing.)

## Hosting the pages

Put the student-facing pages (`upload`, `browse`, `vote`) where students reach them
— GitHub Pages, same as the field guide — and link them from the SBAR lab site.
`console`, `pick`, and `results` are yours; keep those URLs to yourself. (`pick`
and `console` aren't password-protected — they're just unlisted URLs. Don't post them.)

## Privacy / integrity

- Uploads carry only a **pseudonym** — no real names required. Files live in *your*
  Drive, shared view-only by link so students can read finalists without logging in.
- Ballots store an anonymous per-device `voter` id only (to de-dupe re-submits).
- The browse gate (must-submit-first) is a per-device check — it stops honest
  peeking, not a determined bypass. Fine for a graded classroom.

## Local testing without Google

Every page also runs in **DEMO mode** (CONFIG.endpoint = "") against the browser's
local storage, and there's a local test server (`scratchpad/voteserver.py`) that
mimics the whole backend on your own machine — how this was built and smoke-tested
before deploying. Not needed once the Apps Script URL is in.
