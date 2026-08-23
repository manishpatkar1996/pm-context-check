#!/usr/bin/env node

/**
 * Metadata-only analyzer for the previous completed Codex turn.
 *
 * It never emits prompt text, response text, reasoning, tool arguments, tool
 * outputs, or file contents. Local rollout JSONL is an observed implementation
 * detail and is deliberately version-guarded as an experimental input.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const VERSION = "0.1.0";

function fail(message, code = 2) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = {
    format: "json",
    outcome: "unknown",
    outcomeSource: "unknown",
    turn: "latest-completed",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--help" || flag === "-h") args.help = true;
    else if (["--rollout", "--thread-id", "--codex-home", "--format", "--outcome", "--outcome-source", "--turn"].includes(flag)) {
      const value = argv[index + 1];
      if (!value) fail(`Missing value for ${flag}`);
      args[flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
      index += 1;
    } else fail(`Unknown option: ${flag}`);
  }
  return args;
}

function printHelp() {
  process.stdout.write(`pm-context-check analyzer ${VERSION}\n\n`);
  process.stdout.write("Usage: node analyze-codex-task.mjs [options]\n\n");
  process.stdout.write("  --rollout PATH              Analyze one rollout explicitly\n");
  process.stdout.write("  --thread-id ID              Override CODEX_THREAD_ID\n");
  process.stdout.write("  --codex-home PATH           Override ~/.codex\n");
  process.stdout.write("  --turn latest-completed|latest\n");
  process.stdout.write("  --outcome success|partial|failed|unknown\n");
  process.stdout.write("  --outcome-source observed|user|unknown\n");
  process.stdout.write("  --format json|markdown\n");
}

function walkJsonl(directory, results = []) {
  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walkJsonl(fullPath, results);
    else if (entry.isFile() && entry.name.endsWith(".jsonl")) results.push(fullPath);
  }
  return results;
}

function locateRollout(args) {
  if (args.rollout) return { file: path.resolve(args.rollout), selection: "explicit" };

  const codexHome = path.resolve(args.codexHome || path.join(os.homedir(), ".codex"));
  const sessionsDirectory = path.join(codexHome, "sessions");
  const threadId = args.threadId || process.env.CODEX_THREAD_ID || null;
  let candidates = walkJsonl(sessionsDirectory);
  if (threadId) candidates = candidates.filter((candidate) => path.basename(candidate).includes(threadId));
  candidates = candidates
    .map((file) => ({ file, modified: fs.statSync(file).mtimeMs }))
    .sort((left, right) => right.modified - left.modified);

  if (candidates.length === 0) {
    const detail = threadId ? ` for thread ${threadId}` : "";
    fail(`No Codex rollout found${detail} under ${sessionsDirectory}`);
  }
  return {
    file: candidates[0].file,
    selection: threadId ? "current-thread-id" : "newest-file-fallback",
  };
}

function finite(value) {
  return Number.isFinite(value) ? value : 0;
}

function subtractUsage(current, previous = {}) {
  if (!current) return null;
  const fields = [
    "input_tokens",
    "cached_input_tokens",
    "cache_write_input_tokens",
    "output_tokens",
    "reasoning_output_tokens",
    "total_tokens",
  ];
  const result = {};
  for (const field of fields) result[field] = Math.max(0, finite(current[field]) - finite(previous[field]));
  result.fresh_input_tokens = Math.max(
    0,
    result.input_tokens - result.cached_input_tokens - result.cache_write_input_tokens,
  );
  result.cache_read_ratio = result.input_tokens > 0 ? result.cached_input_tokens / result.input_tokens : null;
  return result;
}

function parseRollout(file) {
  if (!fs.existsSync(file)) fail(`Rollout does not exist: ${file}`);
  const source = fs.readFileSync(file, "utf8");
  const rows = [];
  let parseErrors = 0;
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      rows.push(JSON.parse(line));
    } catch {
      parseErrors += 1;
    }
  }
  return { rows, parseErrors, bytes: Buffer.byteLength(source) };
}

function collectTurns(rows) {
  const turns = [];
  let active = null;

  for (const row of rows) {
    const payload = row.payload || {};
    if (row.type === "event_msg" && payload.type === "task_started") {
      active = {
        id: payload.turn_id || null,
        started_at: payload.started_at || row.timestamp || null,
        completed: false,
        completed_at: null,
        duration_ms: null,
        time_to_first_token_ms: null,
        model_context_window: payload.model_context_window || null,
        final_total_usage: null,
        last_response_usage: null,
        tool_calls: 0,
        mcp_calls: 0,
        web_searches: 0,
        patches: 0,
        compactions: 0,
      };
      turns.push(active);
    }
    if (!active) continue;

    const eventName = `${row.type || "unknown"}/${payload.type || "-"}`;
    if (/compact/i.test(eventName)) active.compactions += 1;
    if (row.type === "response_item" && payload.type === "custom_tool_call") active.tool_calls += 1;
    if (row.type === "event_msg" && payload.type === "mcp_tool_call_end") active.mcp_calls += 1;
    if (row.type === "event_msg" && payload.type === "web_search_end") active.web_searches += 1;
    if (row.type === "event_msg" && payload.type === "patch_apply_end") active.patches += 1;

    if (row.type === "event_msg" && payload.type === "token_count") {
      if (payload.info?.total_token_usage) active.final_total_usage = payload.info.total_token_usage;
      if (payload.info?.last_token_usage) active.last_response_usage = payload.info.last_token_usage;
    }
    if (row.type === "event_msg" && payload.type === "task_complete") {
      active.completed = true;
      active.completed_at = payload.completed_at || row.timestamp || null;
      active.duration_ms = payload.duration_ms ?? null;
      active.time_to_first_token_ms = payload.time_to_first_token_ms ?? null;
    }
  }

  let previousTotal = {};
  for (const turn of turns) {
    turn.usage = subtractUsage(turn.final_total_usage, previousTotal);
    if (turn.final_total_usage) previousTotal = turn.final_total_usage;
    turn.context_utilization =
      turn.last_response_usage?.input_tokens && turn.model_context_window
        ? turn.last_response_usage.input_tokens / turn.model_context_window
        : null;
  }
  return turns;
}

function normalizeOutcome(value) {
  const aliases = { yes: "success", worked: "success", partly: "partial", no: "failed" };
  const outcome = aliases[value] || value;
  if (!["success", "partial", "failed", "unknown"].includes(outcome)) fail(`Invalid outcome: ${value}`);
  return outcome;
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function economyScore(utilization, outcome) {
  if (utilization === null) return null;
  let score = utilization <= 0.4 ? 95 : utilization <= 0.65 ? 90 : utilization <= 0.8 ? 75 : utilization <= 0.9 ? 60 : 40;
  if (outcome === "success") score += 5;
  if (outcome === "failed") score -= 15;
  return clamp(score);
}

function scoreSummary(turn, outcome, outcomeSource) {
  const outcomeScore = { success: 100, partial: 60, failed: 20, unknown: null }[outcome];
  const economy = economyScore(turn.context_utilization, outcome);
  const reuse = turn.usage?.cache_read_ratio === null || turn.usage?.cache_read_ratio === undefined
    ? null
    : clamp(turn.usage.cache_read_ratio * 100);

  let overall = null;
  if (outcomeScore !== null && economy !== null && reuse !== null) {
    overall = clamp(outcomeScore * 0.5 + economy * 0.3 + reuse * 0.2);
  }
  const band = overall === null ? "Pending outcome" : overall >= 85 ? "Strong" : overall >= 70 ? "Healthy" : overall >= 55 ? "Mixed" : "Needs attention";
  const confidence = overall === null ? "low" : outcomeSource === "observed" ? "medium-high" : "medium";

  return {
    version: "0.1-experimental",
    overall,
    band,
    confidence,
    weights: { outcome_quality: 0.5, context_economy: 0.3, reuse_efficiency: 0.2 },
    subscores: {
      outcome_quality: outcomeScore,
      context_economy: economy,
      reuse_efficiency: reuse,
    },
    caveat: "The score is provisional and intentionally excludes semantic PM judgments in v0.1.",
  };
}

function recommendations(turn, outcome) {
  const items = [];
  if (outcome === "unknown") items.push("Add two to five acceptance checks to the initial PM brief, or confirm whether the result worked.");
  if (turn.context_utilization !== null && turn.context_utilization > 0.8) items.push("Separate broad discovery from the final decision or deliverable, carrying forward a short decision brief.");
  if (turn.usage?.cache_read_ratio !== null && turn.usage?.cache_read_ratio < 0.7) items.push("Consolidate stable requirements, decisions, and source links into one canonical brief for reuse.");
  if (turn.tool_calls > 20 && outcome !== "success") items.push("Name the source hierarchy and definition of done before asking for extensive research or tool work.");
  if (items.length === 0) items.push("Keep the successful context pattern; next time, state the decision, audience, and acceptance check in the opening brief.");
  return items.slice(0, 3);
}

function analyze(args) {
  const located = locateRollout(args);
  const parsed = parseRollout(located.file);
  const sessionMeta = parsed.rows.find((row) => row.type === "session_meta")?.payload || {};
  const turns = collectTurns(parsed.rows);
  const eligible = args.turn === "latest" ? turns : turns.filter((turn) => turn.completed);
  if (eligible.length === 0) fail("No completed Codex turn is available to analyze yet.");
  if (!["latest", "latest-completed"].includes(args.turn)) fail(`Invalid turn selector: ${args.turn}`);

  const turn = eligible.at(-1);
  const outcome = normalizeOutcome(args.outcome);
  if (!["observed", "user", "unknown"].includes(args.outcomeSource)) fail(`Invalid outcome source: ${args.outcomeSource}`);

  return {
    analyzer: {
      name: "pm-context-check",
      version: VERSION,
      analyzed_at: new Date().toISOString(),
      privacy_mode: "metadata-only",
      experimental_input: true,
    },
    source: {
      file_name: path.basename(located.file),
      selection: located.selection,
      bytes: parsed.bytes,
      parse_errors: parsed.parseErrors,
    },
    session: {
      id: sessionMeta.id || sessionMeta.session_id || null,
      cli_version: sessionMeta.cli_version || null,
      originator: sessionMeta.originator || null,
    },
    turn: {
      id: turn.id,
      completed: turn.completed,
      duration_ms: turn.duration_ms,
      time_to_first_token_ms: turn.time_to_first_token_ms,
      context_window: turn.model_context_window,
      context_utilization: turn.context_utilization,
      input_tokens: turn.usage?.input_tokens ?? null,
      cached_input_tokens: turn.usage?.cached_input_tokens ?? null,
      fresh_input_tokens: turn.usage?.fresh_input_tokens ?? null,
      output_tokens: turn.usage?.output_tokens ?? null,
      cache_read_ratio: turn.usage?.cache_read_ratio ?? null,
      tool_calls: turn.tool_calls,
      mcp_calls: turn.mcp_calls,
      web_searches: turn.web_searches,
      patches: turn.patches,
      compactions: turn.compactions,
    },
    outcome: {
      status: outcome,
      source: args.outcomeSource,
      completion_observed: turn.completed,
      correctness_observed: outcomeSourceIsObserved(args.outcomeSource, outcome),
    },
    score: scoreSummary(turn, outcome, args.outcomeSource),
    recommendations: recommendations(turn, outcome),
    evidence: {
      observed: ["token usage", "cache usage", "context window", "tool lifecycle", "turn completion", "timing when emitted"],
      inferred_or_missing: ["brief clarity", "context relevance", "decision quality", "user acceptance unless supplied", "avoidable rework"],
    },
    limits: [
      "Turn completion does not prove correctness or usefulness.",
      "Local rollout JSONL is not a stable public integration API.",
      "Semantic PM judgments must be labeled as inferred.",
    ],
  };
}

function outcomeSourceIsObserved(source, outcome) {
  return source === "observed" && outcome !== "unknown";
}

function percentage(value) {
  return value === null ? "unknown" : `${Math.round(value * 100)}%`;
}

function number(value) {
  return value === null ? "unknown" : new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function markdown(result) {
  const overall = result.score.overall === null ? "Pending outcome" : `${result.score.overall}/100 · ${result.score.band}`;
  return `# PM Context Check\n\n` +
    `- Provisional score: ${overall}\n` +
    `- Confidence: ${result.score.confidence}\n` +
    `- Outcome: ${result.outcome.status} (${result.outcome.source})\n` +
    `- Context pressure: ${percentage(result.turn.context_utilization)}\n` +
    `- Cache reuse: ${percentage(result.turn.cache_read_ratio)}\n` +
    `- Fresh input: ${number(result.turn.fresh_input_tokens)} tokens\n` +
    `- Tool activity: ${result.turn.tool_calls} calls\n\n` +
    `## Try next\n\n${result.recommendations.map((item) => `- ${item}`).join("\n")}\n\n` +
    `> Metadata-only. Completion is not correctness; semantic PM judgments remain inferred.\n`;
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  printHelp();
  process.exit(0);
}

const result = analyze(args);
if (args.format === "json") process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
else if (args.format === "markdown") process.stdout.write(markdown(result));
else fail(`Invalid format: ${args.format}`);
