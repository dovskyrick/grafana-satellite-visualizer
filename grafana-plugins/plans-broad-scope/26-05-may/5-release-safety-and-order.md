# Release Safety & Order of Operations

## Does `dev` survive? Is anything lost?

**Yes, `dev` is completely untouched.** The three commands only move the `main` pointer to where `dev` already points. `dev` keeps living exactly as it is — same commits, same history, nothing altered. Git commits are immutable objects; `git reset --hard dev` on `main` does not touch the `dev` ref at all. There is zero risk of losing a commit or going back in history. The old December `main` commits also do not disappear — they just become unreferenced, and git won't garbage-collect them for weeks.

## Correct Order of Operations

**Do the README work on `dev` first, then promote.**

```
1. Write/update READMEs on dev  (commit normally)
2. git checkout main
3. git reset --hard dev          (main now == dev, READMEs included)
4. git push --force origin main
5. git tag v1.2.0
6. git push origin v1.2.0
7. Create GitHub Release from tag
```

This way the `v1.2.0` tag captures the complete, documented state. If you promote first and then fix READMEs, your tag either misses the README commits or you have to move the tag — messy. Do the writing on `dev`, then promote once, tag once.
