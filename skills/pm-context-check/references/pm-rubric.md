# PM context-efficiency rubric

Use these lenses for the inferred portion of the report. Rate each as Strong, Mixed, Weak, or Unknown. Never merge these ratings into the analyzer's numeric score in v0.1.

## 1. Brief clarity

Check whether the starting request made the following explicit when relevant:

- Desired decision or deliverable
- Intended audience or user
- Problem or opportunity
- Constraints and non-goals
- Definition of done

Recommend a one-paragraph canonical brief when multiple clarifying turns were needed.

## 2. Decision focus

Check whether the task separated exploration from commitment. Product discovery can be broad; the final decision should identify options, tradeoffs, a recommendation, and unresolved assumptions.

Recommend splitting discovery and production only when their combination caused churn, excessive context pressure, or an ambiguous deliverable.

## 3. Evidence quality

Check whether claims were tied to authoritative sources, user evidence, metrics, experiments, or clearly labeled assumptions. More context is not better when its authority or purpose is unclear.

Recommend a source hierarchy such as: primary evidence, current product facts, constraints, then optional background.

## 4. Iteration hygiene

Check whether follow-ups refined the same goal or repeatedly changed the goal, audience, scope, or format. A deliberate pivot is not waste; unexplained churn is.

Recommend a short decision log after meaningful pivots: decision, reason, implications, and open question.

## 5. Outcome validation

Check whether the task ended with evidence that the output was usable: acceptance, a rubric, stakeholder-ready artifact, test, comparison, or explicit next decision.

Recommend including two to five acceptance checks in the initial prompt when outcome remains unknown.

## Recommendation priority

Choose only one primary recommendation using this order:

1. Missing or failed outcome validation
2. Ambiguous decision or deliverable
3. Unclear audience, constraints, or non-goals
4. Unfocused or weak evidence
5. Avoidable iteration churn
6. Context pressure or low reuse with no demonstrated value

Always preserve a successful behavior before suggesting a change.
