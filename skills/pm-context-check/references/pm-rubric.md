# PM context-effectiveness rubric

Use these lenses for inferred judgments. Rate the pattern, not the person. Do not turn the ratings into a numeric score.

## 1. Brief completeness

Check whether the initial request supplied the relevant parts of a PM brief:

- Goal, decision, or deliverable
- Audience or user
- Known facts, evidence, and links
- Constraints, non-goals, and boundaries
- Requested output format or level of detail
- Acceptance checks when correctness or readiness matters

Do not require every field for every task. Penalize a missing field only when its later arrival caused ambiguity, clarification, drift, or rework.

## 2. Information timing

Compare what was known at the start with what appeared in follow-ups. Distinguish:

- Productive iteration: new knowledge emerged through the work.
- Avoidable late context: the user already knew a requirement but supplied it only after work had to be revised.
- Deliberate pivot: the goal changed for a stated reason.

A longer opening brief can be efficient when it prevents multiple corrective turns.

## 3. Structure and scanability

Check whether instructions separated goal, background, requirements, constraints, and format. Look for a canonical source of truth when the chat becomes long. Repetition is useful when it intentionally restates a decision; it is waste when multiple variants create uncertainty.

Recommend a short template, table, or labeled brief only when structure would materially reduce ambiguity.

## 4. Clarification burden

Count only user turns whose main purpose was answering or correcting an avoidable ambiguity. Do not penalize clarification that surfaces an unknown tradeoff, seeks consent for an external action, or prevents an unsafe assumption.

Look for a recurring root cause: missing audience, unclear scope, absent source, conflicting constraint, undefined format, or unspoken acceptance check.

## 5. Focus and task continuity

Classify each visible user turn once:

- `Progress`: advances the same task with needed information or authorization.
- `Clarification`: answers an ambiguity or fills a missing fact.
- `Refinement`: improves detail, quality, or presentation without changing the goal.
- `Pivot`: changes the goal, audience, approach, or delivery channel.
- `Digression`: introduces an unrelated branch that does not serve the active goal.
- `Rework`: asks to redo work because earlier context was missing, conflicting, or not preserved.

The categories describe trajectory; they are not inherently good or bad.

Assign the primary intent only. Use this tie-break order: `Rework` when the user asks to redo prior work because context was missing or lost; `Pivot` when the goal or delivery channel changes; `Clarification` when a missing fact is supplied before the affected work; `Refinement` for added detail or presentation quality; `Digression` for an unrelated branch; otherwise `Progress`.

## 6. Context recovery and handoff

After a long chat, pivot, or compaction, check whether the shared state preserved:

- Current objective
- Decisions already made
- Unresolved questions
- Relevant artifacts or sources
- Next authorized action

Infer degradation only from visible symptoms such as repeated questions, forgotten constraints, contradictions, duplicated work, or a required recap. A compaction event alone is insufficient.

## Systematic-pattern selection

Choose at most two patterns. Prefer one repeated root cause over a list of surface symptoms. Use this priority:

1. Important context repeatedly supplied late
2. Goal, audience, or scope changed without a clear reset
3. Required format or depth remained implicit
4. Facts, assumptions, and preferences were mixed together
5. Decisions were not carried forward after a long thread or pivot
6. Unnecessary repetition or unrelated digression consumed attention

For each pattern, state `visible evidence → conversation effect → reusable context practice`. If no systematic issue is supported, say so and preserve the strongest context behavior.

## Better opening brief

Produce a compact, reusable example with only the fields that would have prevented the observed friction:

```text
Goal / decision:
Audience:
What is already known:
Constraints / non-goals:
Output shape:
What to preserve from prior work:
```

Do not inflate the example with generic boilerplate.
