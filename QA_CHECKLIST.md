# LIFEOS-002 — QA Checklist (Belief Thread MVP)

> Manual QA for the local, two-week personal trial. This prototype stores
> everything in the browser's `localStorage` (per-browser, no account, no
> server database). There is intentionally no automated test framework —
> the store depends on `localStorage` + `useSyncExternalStore`, and adding
> jsdom/vitest would be heavier than this prototype warrants. Run these
> steps by hand after any change.

## Setup

```bash
npm install
npm run dev      # http://localhost:3000
```

No environment variables are required. With no `ANTHROPIC_API_KEY` set,
the app uses deterministic mock proposals (see "Mock AI fallback" below).

Automated gates (must both pass):

```bash
npm run lint     # expect exit 0
npm run build    # expect exit 0
```

---

## 1. Capture flow

- [ ] Open `/`. The input reads "What's on your mind?" and is focused.
- [ ] Type a passage, click **Capture**. You stay on Home and see a
      confirmation like "Captured. N beliefs waiting in your Inbox."
- [ ] The Inbox nav item shows a count badge equal to the new proposals.
- [ ] **Cmd/Ctrl+Enter** in the input also captures (same as the button).

## 2. Analyze flow

- [ ] Type a passage, click **Analyze**. You are taken straight to
      `/inbox` with the first proposal showing.

## 3. Inbox flow

- [ ] Only **one** proposal is visible at a time (never a wall of cards).
- [ ] The counter reads "N of M" and advances after each decision.
- [ ] The original captured text is shown above the proposed belief.
- [ ] Keyboard: **A** accept, **E** rewrite, **Q** question, **R** reject.
- [ ] After the last decision, an "Inbox clear…" message appears with a
      link to the Constitution.

## 4. Rewrite flow (the primary action)

- [ ] Click the proposed belief (or press **E**) — it becomes editable.
- [ ] Change the wording; the primary button relabels to "Save my version".
- [ ] **Cmd/Ctrl+Enter** or "Save my version" saves YOUR wording as the
      belief text.
- [ ] Clearing the edit and saving falls back to accepting the original
      (no empty belief is ever created).

## 5. Reject / Question flow

- [ ] **Reject** removes the proposal from the queue; the belief appears
      under "Show archived" on the Constitution (dimmed), not in the main
      list.
- [ ] **Question** saves the belief with status "Questioned" (amber dot),
      visible in the main Constitution list, counted in "N still open".

## 6. Constitution expansion

- [ ] `/constitution` groups beliefs by theme, each with a status dot
      (green accepted / blue revised / amber questioned).
- [ ] Header summarizes "N beliefs across M themes · K still open".
- [ ] Click a belief to expand: shows Original capture, Thread, created
      date, and judgment count.

## 7. Revision history / thread line

- [ ] Expand a rewritten belief: the **Thread** shows "Proposed" (struck
      through) → "Rewritten" (current, bold) with dates.
- [ ] In an expanded belief, **Revise** it → a new "Rewritten" node
      appears and "N versions" increments.
- [ ] **Still true** adds a "Reaffirmed" node; **Question** flips status
      to "Questioned". You can watch the thread bend over time.

## 8. Browser refresh persistence

- [ ] Capture and judge a few things, then reload the page. Everything is
      still there (captures, proposals, beliefs, thread history).
- [ ] Open a second tab on the same browser: it reflects the same data on
      load.

## 9. Local data reset

- [ ] Bottom of `/constitution`: **"Reset local prototype data"** →
      confirm → **"Yes, delete everything"** clears all captures,
      proposals, and beliefs. The page returns to its empty state.
- [ ] "Cancel" leaves data untouched.
- [ ] Manual alternative (DevTools console):
      `localStorage.removeItem('lifeos.mvp.v1')` then reload.

## 10. Mock AI fallback

- [ ] With no `ANTHROPIC_API_KEY`, proposals are deterministic: the same
      capture text always yields the same claims. Verify directly:
      ```bash
      curl -s -X POST http://localhost:3000/api/propose \
        -H "content-type: application/json" \
        -d '{"text":"Attention is the beginning of devotion."}'
      ```
      Run twice — output must be identical, with `"source":"mock"`.
- [ ] Mock proposals are labeled with a small "mock" tag in the Inbox.

---

## Edge cases (verified in this hardening pass)

- **Empty / whitespace-only capture** — Capture/Analyze are no-ops; no
  empty capture is created.
- **Double-click Capture** — a synchronous submit guard prevents a
  duplicate capture from a fast double-click.
- **Duplicate captures** — capturing the same text twice is *allowed*
  (you may legitimately re-encounter a passage); each capture is its own
  record. Not treated as an error.
- **Failed AI route / offline** — the client falls back to local
  deterministic mock proposals; capture still succeeds. The API route
  itself also falls back to mock on any Anthropic error.
- **Malformed localStorage** — on load, non-array fields are coerced to
  empty arrays and each belief's `revisions`/`judgments` are guaranteed to
  exist, so bad/hand-edited storage can't crash the app.
- **Rejected proposals** — archived, retained (append-only spirit), never
  shown in the main belief list.
- **Revised beliefs** — old wording is never overwritten; each change is a
  new node in the thread.

## Known limitations (by design, not bugs)

- Data is per-browser `localStorage` only — it does not sync across
  devices/browsers and is lost if the browser profile is cleared. (No
  Supabase yet — that is LIFEOS-001 T3–T6, deferred.)
- The real Anthropic path (`app/api/propose` with a key) is implemented
  but unverified; the mock path is what has been exercised.
- No authentication — the app assumes a single trusted local user.
