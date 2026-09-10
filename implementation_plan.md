# Rearview — Implementation Plan

Six issues, grouped into five phases. Do one phase per working session. Each
phase lists **what changes**, **where**, and **how to verify**. Run
`npm test`, `npm run lint`, `npm run typecheck` at the end of every phase.

> Investigation was done against the running dev app with throwaway
> `@local.test` accounts (since deleted). Root causes below are confirmed, not
> guessed.

---

## Phase 1 — Journal entry editor: save + reload (fixes #2 and #1)

Two separate bugs, same components. Fix together.

### 1a. Formatting save error — `Invalid input: expected record, received function`

**Root cause (confirmed):** Only **numbered / ordered lists** trigger it
(bullets, bold, italic are fine). TipTap's `orderedList` node is the only kept
node with attributes, and `editor.getJSON()` returns them as a
**null-prototype object**: `[Object: null prototype] { start: 1, type: null }`.
When `EntryForm` passes the document to the `saveEntryAction` server action,
Next's RSC serializer cannot serialize a null-prototype object as data, so it
sends it as a **temporary reference** (`"attrs":"$T"` on the wire). On the
server that `$T` deserializes to a **function**, and
`tiptapDocSchema`'s `attrs: z.record(...)` in
`lib/validation/tiptap.ts` rejects it → the error message.

The Zod schema is correct; a plain `{ start: 1, type: null }` passes. The fix
must run **client-side, before the value reaches the server action** — the
server cannot recover a `$T`.

**Change:** In `RichTextEditor`'s `onUpdate`, emit sanitized plain JSON:

```ts
onUpdate: ({ editor: e }) =>
  onChange?.(JSON.parse(JSON.stringify(e.getJSON()))),
```

`JSON.parse(JSON.stringify(...))` strips null prototypes (and any stray
functions), producing the plain document the rest of the app already assumes.
One chokepoint — also fixes the Current Goals editor, which shares
`RichTextEditor`.

**Where:** `app/components/organisms/RichTextEditor.organism.tsx` (the
`onUpdate` callback, ~line 59).

**Verify:**
- New unit test in `lib/validation/journal.test.ts` (or a new
  `lib/editor/*.test.ts`): a doc whose `orderedList.attrs` is
  `Object.create(null)` with `start`/`type` → after `JSON.parse(JSON.stringify)`
  → passes `journalEntryInputSchema`.
- E2E `e2e/specs/entries-authoring.spec.ts` — the existing
  "a numbered list round-trips through save and reload" test passes.
- Manual: type a numbered list, Save — no error; reload the date — list is
  intact.

### 1b. Submitted entry reappears in the new-entry box

**Root cause (confirmed):** `/entries` is a date-addressed editor.
`app/(app)/entries/page.tsx` always loads
`getEntryContentForDate(userId, dateStr)` and passes it to `EntryForm` as
`initialContent`, which `RichTextEditor` mounts as editor content. So after you
save today's entry and come back, the saved entry is loaded straight back into
the same textarea. The previous `resetSignal` / `setDoc(null)` fix only clears
state right after the save — it can't survive a remount.

**Change:** Split "viewing/editing an existing entry" from "the new-entry box".
In `EntryForm`:

- Keep the `DatePicker` visible in all states.
- Add `editing` state, initialised to `false`.
- **If `initialContent` exists and `editing` is `false`:** render the entry
  read-only with `<RichTextContent doc={...} />` inside a bordered card, plus an
  **"Edit entry"** button that sets `editing = true`. Do **not** mount the
  editor.
- **Otherwise** (new date, or `editing === true`): render the editor — empty for
  a new date, seeded with `initialContent` when "Edit entry" was clicked.
- **"Save entry" / "Update entry"** upserts as today. On success:
  `setEditing(false)`, clear the local draft, `router.refresh()`. The page then
  shows the read-only card again (now with the just-saved content).
- Remove the now-unused `resetSignal` plumbing from `EntryForm` **and**
  `RichTextEditor` (the editor unmounts on save instead of being imperatively
  cleared). Optional but tidies both files.

**Where:**
- `app/components/organisms/EntryForm.organism.tsx` (main change)
- `app/components/organisms/RichTextEditor.organism.tsx` (drop `resetSignal`)
- reuse `app/components/molecules/RichTextContent.molecule.tsx` (already a
  read-only TipTap renderer, server-safe)
- `app/(app)/entries/page.tsx` unchanged (still passes `initialContent`)

**Verify:**
- E2E `entries-authoring.spec.ts`: after saving, revisiting the date shows the
  read-only card + "Edit entry" button (not a pre-filled editable box);
  visiting a fresh date shows an empty editor. Update
  "the editor clears after a successful save" to match the new view/edit model.
- Manual: write an entry, Save, navigate to another route and back — the text
  is **not** sitting in an editable box; it shows as a saved entry with an Edit
  button.

**Relationship between 1a and 1b:** independent bugs, same area. Not the same
cause.

---

## Phase 2 — Non-persistent auth session (#3)

**Root cause (confirmed):** `lib/auth.ts` sets a 30-day session and Better Auth
defaults to a **persistent cookie** (`Max-Age` = 30 days), so closing the
browser doesn't end the session. Better Auth's `signInEmail` / `signUpEmail`
accept `rememberMe`; with `rememberMe: false` the `session_token` and
`session_data` cookies are written **without `Max-Age`** (true session cookies,
dropped on browser close). Confirmed in
`node_modules/better-auth/dist/cookies/index.mjs` (lines ~171 and ~97). The DB
session row keeps its expiry — only the cookie changes. `proxy.ts` gates purely
on cookie presence, so:

- in-app navigation still works without re-login (cookie present for the
  browser session)
- fully quitting the browser → next open redirects to `/login`

**Change:** Add `rememberMe: false` to both request bodies:

```ts
await auth.api.signInEmail({
  body: { email: parsed.data.email, password: parsed.data.password, rememberMe: false },
  headers: await headers(),
});
```
```ts
await auth.api.signUpEmail({
  body: { name: ..., email: ..., password: ..., rememberMe: false },
  headers: await headers(),
});
```

**Where:** `app/(auth)/actions.ts` — `signInAction` (~line 46) and
`signUpAction` (~line 67).

**Verify:**
- DevTools → Application → Cookies: `rearview.session_token` (and
  `rearview.session_data`) show **Expires / Max-Age = "Session"**.
- Navigate between Overview / Entries / Memories — no re-login.
- Quit the browser entirely, reopen the app → redirected to `/login`.
- E2E `e2e/specs/auth.spec.ts` still green.

**Caveat (document, don't fix):** browsers with "continue where you left off" /
session-restore preserve session cookies across restarts. That's a browser
setting, out of scope.

---

## Phase 3 — Activity calendar starts at the newest dates (#4)

**Root cause (confirmed):** `YearCalendar.molecule.tsx` renders a full 52–53
week grid (~880px) inside `overflow-x-auto` with no initial scroll handling.
`buildYearGrid` always emits the whole year, so the current year has empty
future weeks and the default view lands mid-year.

**Decisions (from the user):**
- **Past years:** open scrolled all the way right → December is fine.
- **Current year:** the grid should **end at today** — no empty future squares,
  a square is added each day — and open with today visible at the right edge.

**Change:**
1. In `lib/time/activity-grid.ts` → `buildYearGrid`: when
   `year === year-of(today)`, stop the grid at the **week containing `today`**
   instead of Dec 31. Past years are unchanged (full year). This also removes
   the dashed `isFuture` cells for the current year. `today` is already passed
   in — still fully data-driven, nothing hardcoded (respects CLAUDE.md >
   Overview).
2. Make `YearCalendar` a client component (`"use client"`). Add a `ref` on the
   `overflow-x-auto` div and a `useEffect` that sets
   `scrollLeft = scrollWidth` on mount and whenever `grid` changes. For past
   years this shows December; for the current year (grid ends at today) this
   shows today at the right edge.

**Where:**
- `lib/time/activity-grid.ts` (`buildYearGrid`)
- `app/components/molecules/YearCalendar.molecule.tsx`

**Verify:**
- Update `lib/time/activity-grid.test.ts`: for a `today` in September, the
  current-year grid's last week contains `today` and there are **no**
  `isFuture` cells; a past year still spans Jan–Dec.
- Manual: Overview page opens with the calendar showing recent weeks (current
  year → ending at today; switch to a past year → ending at December).
- E2E `e2e/specs/activity-map.spec.ts` still green (adjust if it asserts a
  fixed week count for the current year).

---

## Phase 4 — Local spell check (#5)

**What the user wants:** misspelled words flagged as you type (red squiggle) —
correction optional — **and** a way to dismiss / ignore a flag when the word is
actually fine (names, jargon). "Behave like Google Docs." Must stay local.

### Step 1 — Native browser spell check (do this first)

Set `spellcheck: "true"` on the editor surface. The browser then shows native
red squiggles while typing, and **right-click → "Add to dictionary"** is the
dismiss/ignore action (persists per browser profile). This is fully offline and
needs no dependencies — it likely covers everything asked.

**Change:** in `RichTextEditor`'s `editorProps.attributes`, add
`spellcheck: "true"` (alongside the existing `aria-label` / `class`).

**Where:** `app/components/organisms/RichTextEditor.organism.tsx`.

**Verify:**
- Type a fast misspelling → red squiggle appears.
- Right-click a correctly-spelled word that's flagged → "Add to dictionary" →
  squiggle gone, stays gone after reload.
- English + German: enable **both** languages in the browser (Chrome:
  Settings → Languages → add English + Deutsch, tick "use for spell check").
  Document this in the README.
- DevTools Network: no request to any spell-check service; journal text stays
  in the local DB only.

### Step 2 — In-app spell check (only if Step 1's UX is not enough)

If the native "Add to dictionary" flow feels too hidden / inconsistent, build
an in-app version:

- Deps (all MIT, run locally, ~1–2 MB): `nspell`, `dictionary-en`,
  `dictionary-de`.
- A TipTap decoration plugin that tokenises visible text, checks each word
  against both dictionaries, and underlines unknowns with a red wavy
  decoration.
- A small popover on click: show the word, an **"Ignore"** action, and
  optionally 1–3 suggestions with **"Replace"**.
- Persist the ignore list in `localStorage` (per the CLAUDE.md storage note —
  wrap reads/writes in try/catch; a per-viewer convenience, no server round
  trip).
- Keep it in `lib/editor/spellcheck.ts` + a
  `SpellcheckPopover.molecule.tsx`; wire the plugin in through
  `editor-extensions.ts` or as an editor prop. Keep files < 150 lines.

**Verify:** misspelling flagged on typing; "Ignore" clears that word
permanently (survives reload); "Replace" swaps the word; nothing leaves the
machine (Network tab empty of external calls; dictionaries bundled).

**Recommendation:** ship Step 1, live with it for a few days, only do Step 2 if
the dismiss UX actually annoys you.

---

## Phase 5 — Local voice-to-text (#6)

**What the user wants:** voice input for entries. Free, English + German,
offline, **no audio or text sent to any server** (personal journal content). A
one-time model download is acceptable.

**Approach — in-browser Whisper (transformers.js):** nothing ever leaves the
browser — not even to Rearview's own server.

- Dep: `@huggingface/transformers` (Apache-2.0, free).
- Model: `onnx-community/whisper-base` or `whisper-small` (multilingual, covers
  EN + DE). Runs via WASM, or WebGPU when available (much faster).
- Flow: a mic button records with `MediaRecorder` → audio goes to a Web Worker
  running the Whisper pipeline → transcript is inserted at the editor cursor.
- Model name configurable via env (CLAUDE.md > AI: "model names must be
  configurable"), e.g. `VOICE_MODEL`.
- **Maximum privacy option:** vendor the model files into `public/models/…` and
  point transformers.js at that local path, so even the weights load from
  `localhost` and there is zero external network traffic. Otherwise the weights
  download once from the HuggingFace CDN — that's public model files only, no
  journal data — and are cached by the browser.

**Where:**
- new `app/components/molecules/VoiceInput.molecule.tsx` (mic button + state)
- new `lib/editor/transcribe.ts` + a worker file
- wired into `EntryForm` or `RichTextEditor` near the toolbar
- `lib/env.ts` for the model name
- README note on first-run download size / WebGPU

**Verify:**
- Record a short English clip and a short German clip → correct text inserted
  at the cursor.
- DevTools Network while recording/transcribing: **no** requests carrying audio
  or text; the only external request ever is the one-time model-weights
  download (or none at all if vendored locally).
- The rest of the app works unchanged when the feature is idle or the model is
  still loading.

**Fallback (only if in-browser accuracy/speed is inadequate, esp. German):** a
local `whisper.cpp` (or `faster-whisper`) process + a new
`app/api/transcribe/route.ts` that proxies the recorded blob to it on
`localhost`. Still fully local, but an extra process to install and run.

---

## Suggested order

1. **Phase 1** — formatted-entry save is broken; also fixes the reappearing
   text. Highest priority.
2. **Phase 2** — tiny, independent.
3. **Phase 3** — small, independent.
4. **Phase 4 Step 1** — one line, independent.
5. **Phase 5** — largest; do last.

Phases 1–3 are independent. Phases 4 and 5 both touch `RichTextEditor`, so land
them after Phase 1.

## Definition of done (per CLAUDE.md)

- follows the existing architecture and Atomic Design
- files stay < 150 lines (extract if needed)
- no journal content logged, sent to external services, or exposed to the
  client unnecessarily
- types correct, validation present, error states handled
- tests added where behaviour is meaningful
- `npm run lint` + `npm run typecheck` pass
- works against real DB data, no hardcoded dates
