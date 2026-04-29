# Claude Code Prompt — Pulse Neutral Sweep

Copy everything between the lines below into your Claude Code session as the first message. The repo should be at `main` with `Pulse Review.html` and `PULSE_HANDOFF.md` both committed at the project root.

---

```
You're going to apply a CSS-only design sweep to `index.html`. Read these files first, in this order:

1. `PULSE_HANDOFF.md` — your spec. Contains 8 numbered steps, each with byte-exact FIND/REPLACE blocks.
2. `Pulse Review.html` — visual rationale and before/after mocks. Reference only; do not modify.

Then:

1. Create a new branch `pulse-neutral-sweep`.
2. Apply STEP 1 from `PULSE_HANDOFF.md` exactly as specified, using the Edit tool with the FIND text as old_string and REPLACE text as new_string.
3. Run `git diff index.html` and show me the diff.
4. Tell me what to look at in the browser to verify the step worked (paraphrase the VERIFY section).
5. **Stop. Wait for me to confirm "go" before applying the next step.**
6. Repeat for steps 2 through 8.

Hard rules:
- CSS-only. No JavaScript edits anywhere. Do not touch `pulse-card-templates.js`.
- Do not modify the `:root` block (line 17 of `index.html`). The whole point is that `:root` stays as-is.
- If a FIND block does not match the file exactly (whitespace, line content, anything), stop and report the mismatch. Do not improvise an alternative.
- One step per commit. Commit message: `pulse: step N — <short description>`.
- Do not bump the version string until I confirm all 8 steps are landed and the final verification matrix passes.

Do not summarize the spec back to me. Read it, confirm you've read both files, then start STEP 1.
```

---

## What this prompt does well

- **Files-as-spec**: the prompt is short because the real instruction lives in `PULSE_HANDOFF.md`, where Claude Code can re-read any individual step on demand. Short prompt = less drift.
- **Stop after each step**: forces a human verification gate per change. This is the single most important pattern when Claude Code is doing visual work — without it, errors compound silently.
- **No improvisation clause**: "if FIND doesn't match, stop" is the line that prevents the most common Claude Code failure mode (rewriting a CSS rule from memory because the exact match wasn't found).
- **Pre-committed branch + commit format**: makes the work trivially revertable per step (`git revert <sha>`) if any one step regresses.

## If you want a faster, less safe variant

Replace the "Stop. Wait..." line with:

```
Apply all 8 steps as separate commits. Run the final verification matrix from PULSE_HANDOFF.md after step 8. Report back with the matrix results.
```

Use this only if you trust the diffs and don't want to be in the loop per step. The handover doc is engineered so this works, but you lose the per-step regression catch.

## Files in this handover

| File | Purpose |
|---|---|
| `Pulse Review.html` | Visual review with annotated before/after mocks. The "why" document. |
| `PULSE_HANDOFF.md` | Implementation spec with byte-exact FIND/REPLACE blocks. The "what" document. |
| `CC_PROMPT.md` | This file. The entry point for the Claude Code session. |
