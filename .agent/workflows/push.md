---
description: Git add, commit and push all changes with a descriptive message
---
// turbo-all

1. Check current git status to see modified files:
```
git status --short
```

2. Run a production build to check for errors before pushing:
```
cmd /c "npx next build"
```
If the build fails, STOP immediately. Do NOT proceed to step 3. Report the error to the user and help fix it.

3. Stage all changes:
```
git add .
```

4. Commit with a message that summarizes the changed files (use the output from step 1 to build the message). Format: `git commit -m "update: file1; file2; file3"` — use short descriptive basenames.

5. Push to remote:
```
git push
```
