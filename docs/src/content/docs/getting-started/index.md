---
title: Overview
description: What pi-gui is, what it provides, and where to begin.
---

pi-gui is a localhost multi-session web interface for pi. It drives the same
coding-agent SDK and session files as the terminal interface, so models, tools,
skills, extensions, and authentication continue to come from pi.

## What you get

- Multiple open and recent sessions in one browser workspace
- Streaming assistant text, reasoning, and tool calls over SSE
- Steering, follow-ups, abort, model selection, and thinking controls
- A command palette for session and agent actions
- Skill browsing and editing, Git changes, images, and shell commands
- Light and dark themes

## What pi-gui does not replace

pi-gui does not implement a second agent runtime or configuration system. The
browser is a thin client, and the local hub owns pi `AgentSession` instances.
Read [How pi-gui relates to pi](/concepts/ownership/) for the ownership model.

## Next steps

1. [Install the extension and run `/gui`](/getting-started/install/).
2. Learn the supported [extension paths](/extend/) before customizing it.
3. Use the task-sized [recipes](/recipes/) for common changes.
