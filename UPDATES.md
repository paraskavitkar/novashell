# NovaShell — Update & Release Pipeline

How changes get from a v0 chat session to an installable exe on your PC,
with zero manual steps for you.

## The pipeline (fully automatic)

```
v0 makes changes  →  git push github master  →  GitHub Actions (Windows runner)
                                                  ├─ pnpm build (Next standalone)
                                                  ├─ prepare embedded node + server resources
                                                  ├─ cargo/tauri build (Rust core)
                                                  └─ NovaShell-Setup .exe artifact
```

- **Repo:** https://github.com/paraskavitkar/novashell (private)
- **Remote name in this project:** `github` (branch `master`)
- **Workflow:** `.github/workflows/build-windows.yml` — triggers on every push to `master`
  and on version tags (`v*`)

## For v0 (how to push an update)

After finishing + testing a feature in a session:

```bash
git add -A
git commit -m "feat: <what changed>"
git push github master
```

That's it — Actions builds the installer automatically. No user action needed.

### Cutting a release (permanent download link)

When a milestone is worth an installable release:

```bash
git tag v0.2.0          # bump: v0.1.0 → v0.2.0 etc.
git push github --tags
```

The workflow's release job attaches `NovaShell-Setup-<version>.exe` to
https://github.com/paraskavitkar/novashell/releases — a stable link the user
can download any time.

### Checking build status

```bash
gh run list --repo paraskavitkar/novashell --limit 3
gh run watch <run-id> --repo paraskavitkar/novashell   # follow a live build
gh run view <run-id> --repo paraskavitkar/novashell --log-failed  # debug failures
```

Builds take ~15–25 min (Rust cold compile; cached runs are faster).

## For the user (how to get updates)

1. Go to **github.com/paraskavitkar/novashell → Actions** → newest green run →
   download the **NovaShell-Setup** artifact (or **Releases** for tagged versions)
2. Run the setup exe — it installs over the old version
3. Your data is safe: everything lives in `%APPDATA%\NovaShell`, untouched by updates

Or just ask v0: "push an update and give me the download link".

## Rules for v0 (read this every session)

- ALWAYS test in the browser before pushing — never push broken builds
- Push to `github master` at the end of any session that changed code
- Use conventional commit messages (`feat:`, `fix:`, `chore:`)
- Tag a release only when the user asks for a download link or a milestone lands
- If a CI build fails, fix it in the same session (`gh run view --log-failed`)
- NEVER commit `data/` (user DB), `src-tauri/target/`, or `src-tauri/resources/` —
  they are gitignored; keep it that way
