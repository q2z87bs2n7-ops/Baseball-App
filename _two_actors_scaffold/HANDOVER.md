# Handover — Actor Link Game

You are picking up a new project from a previous Claude chat that did the
planning and scaffolding. This document is the bridge.

## What's already done
1. **Planning is complete.** Read `PROJECT_PLAN.md` end-to-end before doing anything else. Decisions on gameplay, scoring, link rules, identity, and architecture are locked.
2. **Scaffold is in place.** All directories, config files, and module stubs exist. Build pipeline (`npm run build`) is wired.
3. **Patterns are borrowed from a sibling project** (a personal MLB tracker). The user did NOT want a wholesale fork — only proven patterns (esbuild config, sw.js shape, state container, Vercel API + Redis sync, CSS theming).

## What you need to do first
1. Read `PROJECT_PLAN.md` (the plan), then `CLAUDE.md` (the rules).
2. Run `npm install` and `npm run build`. Confirm `dist/app.bundle.js` and `dist/styles.min.css` are produced and the version is `0.1.0`.
3. Open `index.html` in a browser (via local static server). You should see the placeholder UI with section nav working. Nothing else functions yet — every game module is a stub.
4. Confirm with the user which phase to start. The plan recommends starting Phase 2 (TMDB plumbing), but the user may want to verify the scaffold builds first.

## What to NOT do without asking
- **Don't restructure.** Folder layout in `PROJECT_PLAN.md` §3 is intentional.
- **Don't add a framework.** No React, no Vue, no Svelte. Vanilla JS is a hard requirement — the user values being able to read every line.
- **Don't change the link rule.** "Movies only" was a deliberate decision. Discussions about TV / talk shows have already been settled.
- **Don't add OAuth or magic-link auth.** The user explicitly chose "two named profiles in localStorage" — keep it dead simple.
- **Don't write docs files unless asked.** PROJECT_PLAN.md and CLAUDE.md already cover this project's structure.

## Environment / secrets the user must provide
Before Phase 2 ships to Vercel, the user needs to set these env vars in the Vercel project settings:
- `TMDB_READ_TOKEN` — TMDB v4 "API Read Access Token" (Bearer style, NOT the v3 key). Get it free at https://www.themoviedb.org/settings/api after creating an account.
- `KV_REST_API_URL` and `KV_REST_API_TOKEN` — provided automatically when you create a free Upstash Redis database via Vercel's marketplace integration.

Locally you can test `/api/*` with `vercel dev`, which reads env vars from a `.env.local` file (gitignored). Tell the user to add one with the same three vars.

## User preferences (carry over)
- **Surgical edits, no rewrites.** Smallest possible diff for every change.
- **Confirm before acting.** Show old/new before applying any code change.
- **Branch convention:** all work goes on a `claude/*` branch first. Don't merge to main without explicit ask.
- **Version bumps:** patch increment per commit on a `claude/*` branch (e.g. `0.1.0 → 0.1.1`); merging to main bumps minor.
- **No emojis in code or commit messages** unless explicitly requested.

## Hand-back trigger
When Phase 5 is complete and a real round of play has happened end-to-end with both
profiles, tag `v1.0.0` and ask the user whether to proceed to Phase 6 (shared
scoreboard) or pause to play-test.
