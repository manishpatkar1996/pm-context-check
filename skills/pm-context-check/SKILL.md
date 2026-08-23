---
name: pm-context-check
description: Review how efficiently a product manager used context in the previous Codex task, using local metadata plus transparent PM-specific judgment. Use after PRDs, product research, strategy, roadmap, prioritization, requirements, stakeholder communication, or other PM work when the user asks how well they framed the task, used evidence, avoided rework, or could work more effectively with AI context.
---

# PM Context Check

Evaluate the previous completed Codex turn. Distinguish context efficiency from token minimization: enough relevant context that produces a usable outcome can be more efficient than a tiny prompt that causes rework.

## Workflow

1. Locate this skill's directory from the loaded `SKILL.md` path.
2. Run the metadata analyzer without reading the rollout file directly:

   ```text
   node <skill-directory>/scripts/analyze-codex-task.mjs --format json
   ```

3. Select the outcome label:
   - Use `success` with source `observed` only when the conversation contains direct acceptance, passing validation, or a clearly completed requested artifact.
   - Use `partial` or `failed` only from similarly explicit evidence.
   - If outcome is unclear, keep it `unknown`. Provide the useful snapshot immediately, withhold the overall score, then ask only: **Did the result work for you: yes, partly, or no?**
   - After the user answers, rerun with `--outcome success|partial|failed --outcome-source user`.
4. Read `references/pm-rubric.md`. Apply its PM lenses only to context already visible in the conversation. Do not open prompt or tool-output text from the rollout.
5. Return the compact report below. Keep it under roughly 250 words unless the user asks for detail.

## Report format

```text
PM Context Check · previous completed task

Provisional score  82/100 · Healthy
Confidence         Medium

Observed
Outcome            Worked · user-confirmed
Context pressure   59% at the final response
Cache reuse        94%
Fresh input        157k cumulative tokens
Tool activity      25 calls

PM habits · inferred
Brief clarity      Strong — audience and deliverable were explicit
Decision focus     Mixed — discovery and final production were combined
Validation         Weak — no acceptance check was defined upfront

Keep
One specific behavior supported by evidence.

Try next
One highest-value, actionable PM recommendation.

Limits
One short sentence covering material unknowns.
```

When the overall score is unavailable, write `Pending outcome` instead of inventing a number. Never describe task completion as correctness.

## Evidence rules

- Label token usage, cache usage, context pressure, timing, tool counts, and lifecycle events as **observed**.
- Label brief clarity, relevance, stale context, duplicated ideas, correction intent, decision quality, and PM behavior as **inferred**.
- Give inferred claims a plain-language reason and use `Strong`, `Mixed`, `Weak`, or `Unknown` rather than false precision.
- Treat the analyzer's numeric score as experimental and provisional. It is a feedback device, not a performance rating.
- Never recommend reducing context merely because token volume is high. Consider the outcome, rework, and whether the context was necessary.

## Privacy and safety

- Keep metadata-only mode as the default.
- Do not quote, print, or persist prompts, responses, reasoning, tool arguments, tool outputs, or file contents from rollout storage.
- Do not upload task data.
- Explain that local rollout JSONL is an observed implementation detail, not a stable public API.
- If local task storage is unavailable, report the limitation and offer a conversation-only PM review marked entirely as inferred.

## Scope

Focus on product-management work. Do not turn the report into a generic coding-performance review. Favor recommendations such as clarifying the decision, audience, constraints, source hierarchy, must-have versus optional requirements, acceptance criteria, and a reusable decision log.
