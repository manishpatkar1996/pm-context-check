# PM Context Check

A local-first Codex skill that helps product managers understand whether they used context effectively in their previous task. It treats context efficiency as achieving a useful outcome with relevant context—not merely using fewer tokens.

## What it reports

- A provisional outcome-adjusted score when the outcome is known
- Context pressure, fresh input, cache reuse, tool activity, and timing
- PM-specific feedback on brief clarity, decision focus, evidence, iteration hygiene, and validation
- A clear separation between observed telemetry and inferred judgment

The analyzer is metadata-only by default. It does not emit prompt text, responses, reasoning, tool arguments, tool outputs, or file contents.

## Install in Codex

Ask Codex:

```text
$skill-installer install https://github.com/manishpatkar1996/pm-context-check/tree/main/skills/pm-context-check
```

Then start a new Codex turn and invoke:

```text
$pm-context-check
```

You can include an outcome directly:

```text
$pm-context-check The PRD was accepted and is ready for implementation.
```

## Current limitation

Version 0.1 reads local Codex rollout metadata as an experimental importer. That storage format is not a stable public API. A future version should use documented app-server token-usage events for a durable integration.

## License

MIT
