---
name: learn-from-reviews
description: >-
  Distill PR review feedback into durable, classified team knowledge that both
  humans and AI read. Run after PRs merge. Use when the user asks to "learn from
  reviews", update conventions/rules from PR feedback, or refresh team knowledge.
---

# Learn From The Mistakes

Turn PR review feedback (which normally evaporates in comment threads) into
classified, version-controlled knowledge that primes the next dev *and* the
next AI session. Closes the loop: feedback → rule → fewer repeat mistakes.

**Hard rule: this skill never commits, pushes, or opens a PR. It produces a
proposal and stops. A human applies and ships it.**

## Knowledge base layout (committed to this repo, under `.ai/`)

| File | Kind it holds | Enforcement |
|---|---|---|
| `.ai/rules.md` | Rule / policy ("must / must not") | hard; promote to lint/CI |
| `.ai/conventions.md` | Convention ("how we do it here") | soft; AI + humans read |
| `.ai/domain.md` | Domain knowledge (business facts) | context, not lint-able |
| `.ai/gotchas.md` | Gotcha / pitfall | warning |
| `.ai/adr/NNN-*.md` | Architecture decision + rationale | record |
| `.ai/quarantine.md` | Preference, not yet team-agreed | needs consensus to promote |
| `.ai/ledger.json` | Provenance for every item | audit trail |

`CLAUDE.md` `@`-imports `.ai/rules.md` and `.ai/conventions.md` so AI sessions
in this repo are auto-primed. Humans read the same files in onboarding.

## Workflow

### 1. Fetch (read-only)
```
python3 .claude/skills/learn-from-reviews/fetch_reviews.py wangpharma-org/Backend-Ecommerce \
  --since <last-run-date from .ai/ledger.json> > /tmp/lfr.json
```
Use `--since` so each run only processes feedback newer than the last run
(`ledger.json.last_run`). First run: omit it (or use `--limit 60`).

### 2. Classify
For each feedback item in `/tmp/lfr.json`, assign exactly one **kind**:

- **rule** — a "must/never" with safety, correctness, security, or contract
  impact. ("never log PII", "all list endpoints paginate")
- **convention** — a repeatable "how we do it" with no hard failure mode.
  ("DTOs end in `Dto`", "use the `Result` wrapper")
- **architecture** — a design choice + the reasoning behind it. → an ADR.
- **domain** — a business fact the code must respect. ("prices stored in
  satang", "orders need QC before ship")
- **gotcha** — "looks correct but breaks because…".
- **preference** — one reviewer's taste, not yet team-agreed → `quarantine.md`.
- **discard** — a one-off bug fix or PR-specific note with no general lesson.
  Do not record it.

Be conservative: when unsure between `convention` and `preference`, choose
`preference`. Noise destroys trust in this system.

### 3. Promote (use the ledger as evidence)
Before writing, check `.ai/ledger.json` for prior occurrences of the same idea:
- a `preference` seen in ≥2 distinct PRs by ≥2 reviewers → propose promotion to
  `convention`.
- a `convention` violated again after being recorded → propose promotion to
  `rule` **and** suggest a concrete lint/CI check.
Record promotions explicitly in the proposal.

### 4. Propose (DO NOT modify `.ai/` canonical files yet)
Write `/tmp/lfr-proposal.md` containing, per candidate:
- proposed **kind** and destination file
- the **statement** (imperative, one line)
- **why** (the rationale — pull it from the review thread, never invent)
- a minimal **code example** when one clarifies it
- **source**: PR number(s) + reviewer(s) + comment URL(s)
- **confidence** (high/med/low) and, if promotion, the evidence
- the exact **diff** that would be applied to the destination file

Then present a compact summary table to the user and STOP.

### 5. Apply (only after explicit human approval)
For each item the human approves:
- append the entry to its destination `.ai/` file (id, statement, why, example,
  `source: PR#… @reviewer`, `added: <date>`)
- append a record to `.ai/ledger.json` items[] with
  `{id, kind, status, source_prs, reviewers, confidence, first_seen, last_seen,
  approved_by, approved_at}`. New items start `status:"proposed"` (or
  `"quarantined"` for preferences) with `approved_by:null`.
- set `ledger.json.last_run` to today

**Approval is CODEOWNERS-gated, not operator-gated.** `.github/CODEOWNERS`
requires a knowledge owner (see `ledger.json.approvers`) to review any `.ai/`
or `CLAUDE.md` change. An item only becomes authoritative when the conventions
PR is approved by an owner — at that point set its `status:"agreed"`,
`approved_by:"<owner login>"`, `approved_at:<date>`. The skill never approves
its own output and never merges.

Leave all changes **uncommitted**. Tell the user to review `git diff` and open
their own PR — the conventions file changes via the team's normal review (that
PR *is* the agreement). Never run git commit/push/PR yourself.

## Notes
- Each `.ai/` entry must carry its source PR link. A rule without a "why" and a
  source gets cargo-culted or ignored — drop it rather than record it rootless.
- The user-level skill (`~/.claude/skills/learn-from-reviews`) only carries the
  operator's personal defaults (e.g. preferred `--limit`); the engine and the
  knowledge base live here, in the repo, so every teammate gets them on clone.
