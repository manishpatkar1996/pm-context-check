---
name: pm-context-check
description: Review how effectively a product manager supplied, structured, and managed context across a Codex chat. Use after PRDs, research, strategy, requirements, stakeholder communication, or other PM work when the user asks about context quality, clarification burden, drift, rework, compaction, token activity, cache reuse, or how to make future AI collaboration more efficient.
---

# PM Context Check

Assess whether the user supplied and managed enough relevant context to keep the work clear, focused, and reusable. Context efficiency is not token minimization: a substantial, well-structured brief that prevents clarification and rework can be more efficient than a short, incomplete prompt.

## Workflow

1. Locate this skill's directory from the loaded `SKILL.md` path.
2. Run the local metadata analyzer. Do not read rollout content directly:

   ```text
   node <skill-directory>/scripts/analyze-codex-task.mjs --scope chat --format json
   ```

3. Verify `source.selection` is `current-thread-id`. If it is `newest-file-fallback`, label the telemetry scope `unverified` and do not imply that its counts describe the visible chat. If no current-chat telemetry can be verified, omit it and continue with an inferred conversation-only review.
4. Read `references/pm-rubric.md`.
5. Using only conversation content already visible in the chat, classify each user turn as one of: `Progress`, `Clarification`, `Refinement`, `Pivot`, `Digression`, or `Rework`. Treat the classification as inferred. Combine consecutive turns when that makes the trajectory easier to scan.
6. Compare early instructions with details introduced later. Identify no more than two recurring context patterns that caused avoidable clarification, drift, or rework. Do not penalize necessary discovery or a deliberate pivot.
7. Return the report below. Do not ask whether the product outcome succeeded; this review is about the user's use of context.

## Report format

Keep the report compact and visually scannable—usually under 350 words.

```text
PM CONTEXT REVIEW · Current chat

CONTEXT EFFECTIVENESS   MIXED · medium confidence
The one-sentence diagnostic: what worked, what repeatedly arrived late, and why it mattered.

OBSERVED TELEMETRY
| Signal | Reading |
|---|---:|
| Turns | 8 total · 7 completed · 1 active |
| Context load | Latest ███████░░░ 75% · Peak 75% |
| Token activity | 20.1M input · 19.6M cached · 515k fresh · 94k output |
| Cache reuse | 97.4% |
| Tool activity | 151 top-level calls |
| Compaction | ↻ 1 estimated lifecycle |

TASK TRAJECTORY · inferred
① Define → ② Feasibility → ③ Refine ↻ → ④ Build → ⑤ Publish → ⑥ Validate → ⑦ Redesign

CONVERSATION SHAPE · inferred
Progress 3 · Clarify 1 · Refine 2 · Pivot 1 · Digress 0 · Rework 1

CONTEXT QUALITY · inferred
| Dimension | Rating | Evidence |
|---|---|---|
| Brief completeness | Mixed | Audience was clear; report shape arrived later |
| Information timing | Needs work | Key constraints appeared after implementation |
| Structure | Mixed | Requirements were useful but distributed across turns |
| Clarification burden | Strong | Little avoidable question-and-answer overhead |
| Focus and continuity | Mixed | One deliberate pivot, no unrelated detour |
| Recovery and handoff | Strong | Later summary restored a usable shared state |

SYSTEMATIC PATTERN · inferred
| Pattern | Evidence → effect | Better context pattern |
|---|---|---|
| Format specified late | Two later refinements → repeated presentation work | Put the desired report skeleton in the opening brief |

HIGHEST-LEVERAGE CONTEXT IMPROVEMENT · inferred
One specific behavior to change, written as an instruction the PM can reuse.

BETTER OPENING BRIEF · inferred
A compact example that front-loads the missing context without bloating the prompt.

LIMITS
One sentence covering the most material measurement limitation.
```

Use Markdown tables and Unicode bars/arrows; do not put the entire report in a code fence. Omit a row only when its value is unavailable. If the report would become crowded, show the most diagnostic four quality dimensions and put the rest in one sentence.

## Rating rules

- `Strong`: the context pattern consistently reduced ambiguity or preserved focus.
- `Mixed`: useful context was present but distributed, late, or inconsistently structured.
- `Needs work`: missing, conflicting, or poorly timed context repeatedly caused avoidable clarification, drift, or rework.
- Confidence is `high` only with both usable telemetry and clear evidence across at least five visible user turns; `medium` with partial telemetry or two to four evidence-rich turns; otherwise `low`.
- Do not calculate or display a pseudo-precise 0–100 score.

## Evidence rules

- Label turn counts, token activity, cache activity, context utilization, tool-call envelopes, and compaction events as **observed**.
- Label trajectory, relevance, duplication, clarification necessity, drift, rework, context degradation, and PM habits as **inferred**.
- `Input tokens` means cumulative input activity across model requests, not the current context size.
- `Cache reuse` means the share of input activity reported as cached. It can lower repeated processing, but it does not prove that reused content was relevant.
- A compaction is a context-management event, not automatic evidence of failure. Discuss degradation only when the visible conversation shows lost requirements, repeated questions, contradictions, or recovery work.
- More turns are not automatically inefficient. Penalize only avoidable turns caused by context gaps, unclear structure, or failure to preserve decisions.
- Top-level tool-call envelopes may contain nested calls; never present them as an exact count of every underlying operation.

## Privacy and fallback

- Keep metadata-only mode as the default.
- Do not quote, print, or persist prompts, responses, reasoning, tool arguments, tool outputs, or file contents from rollout storage.
- Do not upload task data.
- Explain that local rollout JSONL is an observed implementation detail, not a stable public API.
- If local task storage is unavailable, provide the same report from the visible conversation, mark all readings inferred, and omit telemetry rather than inventing it.

## Scope

Focus recommendations on PM context practice: decision and audience, known facts and evidence, constraints and non-goals, requested format, acceptance checks, source hierarchy, and a compact decision/handoff brief. Do not turn the review into a generic assessment of coding performance or product-output quality.
