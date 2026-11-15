---
name: push
description: Commit all current changes with a descriptive message and push to GitHub. Runs only when the user types the /push command.
disable-model-invocation: true
---

# Push: commit and push changes

The user typing `/push` is their go-ahead to commit everything that changed and push it to `origin`. Do it without asking for confirmation, except in the stop cases below. The word "push" in ordinary conversation is not a trigger.

## Steps

1. **Check what changed**
   ```
   git status --short
   git diff --stat
   ```
   If nothing has changed and nothing is waiting to be pushed (`git status` says "up to date" with a clean tree), tell the user there's nothing to push and stop.

2. **Look out for files that shouldn't be committed.** Don't stage these; tell the user you left them out:
   - secrets: `.env*`, `*.pem`, `*.key`, or any file containing API keys or tokens
   - large build artifacts or `node_modules/`
   - anything matching `.gitignore` (git already skips these)

3. **Stage and commit**
   - Stage the changes: `git add -A`, minus anything excluded in step 2.
   - Write a short commit message in plain language. The first line says what changed for the site (e.g. "Update host guide copy and fix Discord link"), under 72 characters. Read the diff to write it; never use a generic message like "Update files".
   - End the message with a blank line, then:
     `Co-Authored-By: Claude <noreply@anthropic.com>`

4. **Push**
   ```
   git push origin HEAD
   ```
   - If the push is rejected because the remote has new commits, run `git pull --rebase origin <branch>`, then push again. If the rebase hits conflicts, stop and explain them to the user in plain language.
   - Never force push.

5. **Report back** in 2–3 lines: what was committed, plus the short commit hash. If the branch is `main`, add that the live site at https://gigi1111.github.io/women-vibe-coder-website/ updates in about a minute.

## Stop and ask instead when
- The repo is in the middle of a merge or rebase.
- You'd be committing on a branch other than `main` and the user didn't mention a branch. Ask whether to push that branch.
- A possible secret turned up in the changes.
