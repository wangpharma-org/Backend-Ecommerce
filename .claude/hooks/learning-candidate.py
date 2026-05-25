#!/usr/bin/env python3
"""Stop hook: spot teachable feedback in a session and log a learning candidate.

Complements the `learn-from-reviews` skill — it NEVER edits CLAUDE.md or .ai/*.md.
It only appends a candidate note to a gitignored scratch file and nudges the user
(at most once per session) to run /learn-from-reviews so the human-in-the-loop
distillation stays intact. Always exits 0; never blocks the turn.

Stdin payload (Stop hook): { session_id, transcript_path, cwd, stop_hook_active, ... }
Output (only when a new candidate is logged): { "systemMessage": "...", "suppressOutput": true }
"""
import json
import os
import sys
from datetime import datetime

# Intentful corrective/teaching phrases (TH + EN). Kept phrase-level on purpose:
# bare words like "always"/"never"/"instead" and loose Thai substrings like "ที่ถูก"
# (which matches "ที่ถูกเรียกใช้") produced false positives, so they are excluded.
SIGNALS = [
    # Thai — specific corrective phrasing
    "ไม่ใช่", "ที่ถูกคือ", "ที่ถูกต้อง", "ที่จริงแล้ว", "จริงๆ แล้ว",
    "อย่าลืม", "ห้าม", "แก้เป็น", "เปลี่ยนเป็น", "ควรเป็น", "ควรใช้",
    "คราวหน้า", "ครั้งหน้า", "ต่อไปนี้", "จำไว้", "ผิดแล้ว", "ไม่ถูก",
    # English — phrase-level
    "should be", "should use", "should have", "instead of", "that's wrong",
    "that is wrong", "not correct", "incorrect", "next time", "from now on",
    "remember to", "you forgot", "don't forget", "not quite",
]

# Markers that a "user" message is actually injected (slash-command / skill output /
# system reminder), not something the human typed — skip these.
INJECTED_MARKERS = ("<command-name>", "<command-message>", "<command-args>",
                    "<local-command-stdout>", "<system-reminder>", "<ide_")
MAX_TYPED_LEN = 4000  # huge messages are pastes / skill output, not typed feedback


def user_text(obj):
    """Real user-typed text from a transcript line, or "" to skip.

    Skips tool_result blocks, injected command/skill output, and oversized pastes.
    """
    if obj.get("type") != "user":
        return ""
    content = (obj.get("message") or {}).get("content")
    if isinstance(content, str):
        text = content
    elif isinstance(content, list):
        text = "\n".join(b.get("text", "") for b in content
                         if isinstance(b, dict) and b.get("type") == "text")
    else:
        return ""
    stripped = text.strip()
    if not stripped or stripped.startswith("#"):          # markdown/skill doc output
        return ""
    if len(text) > MAX_TYPED_LEN:                          # paste / injected blob
        return ""
    if any(m in text for m in INJECTED_MARKERS):           # command/skill/system inject
        return ""
    return text


def main():
    try:
        payload = json.loads(sys.stdin.read() or "{}")
    except Exception:
        return

    transcript_path = payload.get("transcript_path")
    session_id = payload.get("session_id") or "unknown"
    project_dir = os.environ.get("CLAUDE_PROJECT_DIR") or payload.get("cwd") or os.getcwd()

    if not transcript_path or not os.path.isfile(transcript_path):
        return

    claude_dir = os.path.join(project_dir, ".claude")
    scratch = os.path.join(claude_dir, "learning-candidates.local.md")
    state = os.path.join(claude_dir, ".learning-seen.json")

    # Dedupe: at most one candidate per session.
    try:
        with open(state) as f:
            seen = json.load(f)
            if not isinstance(seen, list):
                seen = []
    except Exception:
        seen = []
    if session_id in seen:
        return

    hits = []  # (matched_signals, snippet)
    all_signals = set()
    try:
        with open(transcript_path, encoding="utf-8", errors="replace") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except Exception:
                    continue
                text = user_text(obj)
                if not text.strip():
                    continue
                low = text.lower()
                matched = [s for s in SIGNALS if s.lower() in low]
                if matched:
                    all_signals.update(matched)
                    hits.append((matched, " ".join(text.split())[:160]))
    except Exception:
        return

    if not hits:
        return

    try:
        os.makedirs(claude_dir, exist_ok=True)
        ts = datetime.now().astimezone().strftime("%Y-%m-%d %H:%M:%S %z")
        new_file = not os.path.exists(scratch)
        with open(scratch, "a", encoding="utf-8") as f:
            if new_file:
                f.write("# Learning candidates (personal, gitignored)\n\n")
                f.write("> Auto-collected by the Stop hook when a session held teachable feedback.\n")
                f.write("> Review, then run `/learn-from-reviews` to distill into `.ai/*.md` via PR.\n\n")
            f.write(f"## {ts} — session `{session_id[:8]}`\n")
            f.write(f"- {len(hits)} message(s) with teaching signals\n")
            for matched, snip in hits[:5]:
                f.write(f'  - [{", ".join(matched)}] "{snip}"\n')
            f.write("\n")
    except Exception:
        return

    try:
        seen.append(session_id)
        with open(state, "w", encoding="utf-8") as f:
            json.dump(seen[-500:], f)
    except Exception:
        pass

    print(json.dumps({
        "systemMessage": "📝 พบ feedback ที่อาจเป็น learning ในเซสชันนี้ — บันทึกไว้ที่ "
                         ".claude/learning-candidates.local.md แล้ว ลองรัน /learn-from-reviews "
                         "ตอนจบงานเพื่อกลั่นเป็น .ai/*.md",
        "suppressOutput": True,
    }, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
    sys.exit(0)
