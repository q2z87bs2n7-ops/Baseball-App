Run the end-of-session checklist:

1. **Version bump** — increment the patch version in `index.html` `<title>` tag and `.settings-version` div (e.g. v3.34.2 → v3.34.3)
2. **Cache bust** — bump `CACHE` constant in `sw.js` by 1 (e.g. `mlb-v475` → `mlb-v476`)
3. **CLAUDE.md** — append a one-line summary of changes made this session to the version history paragraph in the "What This Is" section; add any new globals to the Key Global State block; add any new functions to the Key Functions Reference table
4. **Commit** — stage all changed files and write a clear descriptive commit message
5. **Push** — push to the current feature branch with `git push -u origin <branch-name>`

Report back: what version was set, what CACHE value was set, and confirm all five steps are done.
