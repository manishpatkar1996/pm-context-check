# PM Context Check

A local-first Codex skill that shows product managers how effectively they supplied, structured, and managed context across a chat. It treats context efficiency as keeping work clear and focused with enough relevant information—not simply minimizing tokens.

## What the report shows

- A visual task trajectory and conversation-shape summary
- Brief completeness, information timing, structure, clarification burden, focus, and context recovery
- Systematic context patterns that caused avoidable drift or rework
- Observed turns, context utilization, cumulative token activity, cache reuse, tool activity, and estimated compaction lifecycles
- One high-leverage improvement and a better opening brief for the next similar task

The report explicitly separates observed telemetry from inferred conversation judgments. It does not grade product outcomes or pretend that more turns, more tokens, or compaction are automatically bad.

## Install in Codex

Ask Codex:

```text
$skill-installer install https://github.com/manishpatkar1996/pm-context-check/tree/main/skills/pm-context-check
```

Then start a new Codex turn and invoke:

```text
$pm-context-check
```

The skill reviews the current chat by default. You can add a focus, for example:

```text
$pm-context-check Focus on whether I supplied requirements and format early enough.
```

## Privacy and implementation status

Version 0.2 reads metadata from the local Codex rollout for the current task. The analyzer emits counts and ratios only; it does not emit prompts, responses, reasoning, tool arguments, tool outputs, or file contents.

The local rollout format is an experimental importer, not a stable public API. Cumulative input tokens represent activity across model requests, not the current context size. Cache reuse is provider-reported reuse, not proof of contextual relevance. A future integration should use documented Codex app-server events where available.

## License

MIT
