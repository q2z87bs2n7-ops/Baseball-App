Run the session start checklist to ensure we are working from the latest remote main:

1. **Fetch** — run `git fetch origin` to pull latest remote state without merging
2. **Check status** — run `git log --oneline HEAD..origin/main` to show any commits on remote main that are not local; if there are none, note that local main is already up to date
3. **Sync main** — run `git checkout main && git pull origin main` to bring local main fully up to date
4. **Create branch** — create a new `claude/` branch from this clean main using the format `claude/DESCRIPTION-XXXXX` where DESCRIPTION is a short kebab-case summary of today's planned work and XXXXX is 5 random alphanumeric characters; use `git checkout -b <branch-name>`
5. **Confirm** — report the new branch name, the current version from `index.html` `<title>`, and the current `CACHE` value from `sw.js` so we have a clear baseline

Ask the user for a one-line description of today's work before creating the branch if none was provided in the original message.
