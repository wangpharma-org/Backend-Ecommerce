#!/usr/bin/env python3
"""Pull merged-PR review feedback for a repo so it can be distilled into rules.

Usage: fetch_reviews.py <owner/repo> [--limit N] [--since YYYY-MM-DD]
Writes JSON to stdout: a list of feedback items, each with source provenance.
Read-only. Requires `gh` authenticated.
"""
import json, subprocess, sys, argparse


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
        # inline code-review comments
        inline = json.loads(gh(["api", f"repos/{a.repo}/pulls/{n}/comments",
                                "--paginate"]) or "[]")
        for c in inline:
            if not c.get("body", "").strip():
                continue
            items.append({
                "pr": n, "pr_title": p["title"], "pr_author": author,
                "reviewer": c["user"]["login"],
                "type": "inline",
                "path": c.get("path"), "line": c.get("line") or c.get("original_line"),
                "diff_hunk": (c.get("diff_hunk") or "")[-400:],
                "body": c["body"].strip(),
                "url": c.get("html_url"),
            })
        # top-level review summaries (request-changes / approve with notes)
        reviews = json.loads(gh(["api", f"repos/{a.repo}/pulls/{n}/reviews"]) or "[]")
        for r in reviews:
            if not (r.get("body") or "").strip():
                continue
            items.append({
                "pr": n, "pr_title": p["title"], "pr_author": author,
                "reviewer": r["user"]["login"],
                "type": "review", "state": r.get("state"),
                "body": r["body"].strip(),
                "url": r.get("html_url"),
            })

    json.dump({"repo": a.repo, "prs_scanned": len(prs),
               "feedback_count": len(items), "items": items},
              sys.stdout, indent=2, ensure_ascii=False)


if __name__ == "__main__":
    main()
