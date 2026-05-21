#!/usr/bin/env python3
"""Pull merged-PR review feedback for a repo so it can be distilled into rules.

Usage: fetch_reviews.py <owner/repo> [--limit N] [--since YYYY-MM-DD]
Writes JSON to stdout: a list of feedback items, each with source provenance.
Read-only. Requires `gh` authenticated.

Each item carries `origin`:
  - "human"     : a person's review/comment   -> full-tier signal
  - "ai-review" : an automated Claude/bot review (e.g. the claude-code-review
                  workflow that posts via `gh pr comment`) -> SECONDARY signal.
                  Distil it but never auto-promote an ai-only item to a hard
                  rule (see SKILL.md "Provenance & AI tier"). This prevents an
                  AI echo chamber where Claude ratifies its own opinions.
"""
import json, subprocess, sys, argparse, re

# bot / app identities whose feedback is AI-generated, not a human teammate
AI_LOGIN = re.compile(r'\[bot\]$|github-actions|claude|^app/', re.I)


def origin_of(login: str) -> str:
    return "ai-review" if login and AI_LOGIN.search(login) else "human"


def gh(args):
    out = subprocess.run(["gh", *args], capture_output=True, text=True)
    if out.returncode != 0:
        return None
    return out.stdout


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("repo")
    ap.add_argument("--limit", type=int, default=60, help="max merged PRs to scan")
    ap.add_argument("--since", default=None, help="only PRs merged on/after this date")
    a = ap.parse_args()

    prs = json.loads(gh(["pr", "list", "--repo", a.repo, "--state", "merged",
                         "--limit", str(a.limit),
                         "--json", "number,title,mergedAt,author"]) or "[]")
    if a.since:
        prs = [p for p in prs if (p.get("mergedAt") or "") >= a.since]

    items = []
    for p in prs:
        n = p["number"]
        author = (p.get("author") or {}).get("login", "?")

        def add(reviewer, **kw):
            items.append({"pr": n, "pr_title": p["title"], "pr_author": author,
                          "reviewer": reviewer, "origin": origin_of(reviewer), **kw})

        # 1. inline code-review comments
        for c in json.loads(gh(["api", f"repos/{a.repo}/pulls/{n}/comments",
                                "--paginate"]) or "[]"):
            if not c.get("body", "").strip():
                continue
            add(c["user"]["login"], type="inline",
                path=c.get("path"), line=c.get("line") or c.get("original_line"),
                diff_hunk=(c.get("diff_hunk") or "")[-400:],
                body=c["body"].strip(), url=c.get("html_url"))

        # 2. top-level review summaries (request-changes / approve with notes)
        for r in json.loads(gh(["api", f"repos/{a.repo}/pulls/{n}/reviews"]) or "[]"):
            if not (r.get("body") or "").strip():
                continue
            add(r["user"]["login"], type="review", state=r.get("state"),
                body=r["body"].strip(), url=r.get("html_url"))

        # 3. PR-level issue comments — this is where the claude-code-review
        #    workflow posts (via `gh pr comment`), and where many human
        #    discussion notes live. Tagged via origin (human vs ai-review).
        for c in json.loads(gh(["api", f"repos/{a.repo}/issues/{n}/comments",
                                "--paginate"]) or "[]"):
            if not (c.get("body") or "").strip():
                continue
            add((c.get("user") or {}).get("login", "?"), type="issue_comment",
                body=c["body"].strip(), url=c.get("html_url"))

    by_origin = {}
    for it in items:
        by_origin[it["origin"]] = by_origin.get(it["origin"], 0) + 1

    json.dump({"repo": a.repo, "prs_scanned": len(prs),
               "feedback_count": len(items), "by_origin": by_origin,
               "items": items},
              sys.stdout, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
