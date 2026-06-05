"""
PostToolUse hook — log Jira issues created via mcp__atlassian__createJiraIssue
Receives JSON on stdin: { tool_name, tool_input, tool_response }
Appends to D:\WP\jira-created.log
"""
import json
import sys
from datetime import datetime
from pathlib import Path

LOG_PATH = Path(r"D:\WP\jira-created.log")

try:
    data = json.load(sys.stdin)

    tool_input = data.get("tool_input", {})
    tool_response = data.get("tool_response", {})

    key = tool_response.get("key", "?")
    summary = tool_input.get("summary", tool_response.get("fields", {}).get("summary", "?"))
    project = tool_input.get("projectKey", "?")
    issue_type = tool_input.get("issueTypeName", "?")
    parent = tool_input.get("parent", "")
    ts = datetime.now().strftime("%Y-%m-%d %H:%M")

    parent_str = f" (subtask of {parent})" if parent else ""
    line = f"[{ts}] {key} [{project}/{issue_type}]{parent_str} — {summary}\n"

    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(line)

except Exception:
    pass  # hook must never block Claude
