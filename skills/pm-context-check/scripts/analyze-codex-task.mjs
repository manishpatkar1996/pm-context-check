#!/usr/bin/env node

/**
 * Metadata-only analyzer for a Codex chat or one completed turn.
 *
 * It never emits prompt text, response text, reasoning, tool arguments, tool
 * outputs, or file contents. Local rollout JSONL is an observed implementation
 * detail and is deliberately version-guarded as an experimental input.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const VERSION = "0.2.0";
const USAGE_FIELDS = [
  "input_tokens",
  "cached_input_tokens",
  "cache_write_input_tokens",
  "fresh_input_tokens",
  "output_tokens",
  "reasoning_output_tokens",
  "total_tokens",
];

function fail(message, code = 2) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = { format: "json", scope: "chat", turn: "latest-completed" };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--help" || flag === "-h") args.help = true;
    else if (["--rollout", "--thread-id", "--codex-home", "--format", "--scope", "--turn"].includes(flag)) {
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
  process.stdout.write("  --scope chat|turn           Default: chat\n");
  process.stdout.write("  --turn latest-completed|latest  Used with --scope turn\n");
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
  return { file: candidates[0].file, selection: threadId ? "current-thread-id" : "newest-file-fallback" };
}

function finite(value) {
  return Number.isFinite(value) ? value : 0;
}

function subtractUsage(current, previous = {}) {
  if (!current) return null;
  const result = {};
  for (const field of USAGE_FIELDS.filter((field) => field !== "fresh_input_tokens")) {
    result[field] = Math.max(0, finite(current[field]) - finite(previous[field]));
  }
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

function blankTurn(payload, row) {
  return {
    id: payload.turn_id || null,
    started_at: payload.started_at || row.timestamp || null,
    completed: false,
    completed_at: null,
    duration_ms: null,
    time_to_first_token_ms: null,
    model_context_window: payload.model_context_window || null,
    final_total_usage: null,
    last_response_usage: null,
    top_level_tool_calls: 0,
    nested_mcp_calls: 0,
    web_searches: 0,
    patches: 0,
    compaction_events_by_type: {},
  };
}

function collectTurns(rows) {
  const turns = [];
  let active = null;

  for (const row of rows) {
    const payload = row.payload || {};
    if (row.type === "event_msg" && payload.type === "task_started") {
      active = blankTurn(payload, row);
      turns.push(active);
    }
    if (!active) continue;

    const eventName = `${row.type || "unknown"}/${payload.type || "-"}`;
    if (/compact/i.test(eventName)) {
      active.compaction_events_by_type[eventName] = (active.compaction_events_by_type[eventName] || 0) + 1;
    }
    if (row.type === "response_item" && payload.type === "custom_tool_call") active.top_level_tool_calls += 1;
    if (row.type === "event_msg" && payload.type === "mcp_tool_call_end") active.nested_mcp_calls += 1;
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
    const compactionCounts = Object.values(turn.compaction_events_by_type);
    turn.compaction_raw_events = compactionCounts.reduce((sum, count) => sum + count, 0);
    // Codex can emit more than one event type for one compaction. The largest
    // per-type count is the best metadata-only estimate of distinct lifecycles.
    turn.compaction_lifecycles = compactionCounts.length > 0 ? Math.max(...compactionCounts) : 0;
  }
  return turns;
}

function sumUsage(turns) {
  const totals = Object.fromEntries(USAGE_FIELDS.map((field) => [field, 0]));
  for (const turn of turns) {
    for (const field of USAGE_FIELDS) totals[field] += finite(turn.usage?.[field]);
  }
  totals.cache_read_ratio = totals.input_tokens > 0 ? totals.cached_input_tokens / totals.input_tokens : null;
  return totals;
}

function compactTurn(turn, index) {
  return {
    sequence: index + 1,
    id: turn.id,
    completed: turn.completed,
    duration_ms: turn.duration_ms,
    context_window: turn.model_context_window,
    context_utilization: turn.context_utilization,
    input_tokens: turn.usage?.input_tokens ?? null,
    cached_input_tokens: turn.usage?.cached_input_tokens ?? null,
    cache_write_input_tokens: turn.usage?.cache_write_input_tokens ?? null,
    fresh_input_tokens: turn.usage?.fresh_input_tokens ?? null,
    output_tokens: turn.usage?.output_tokens ?? null,
    cache_read_ratio: turn.usage?.cache_read_ratio ?? null,
    top_level_tool_calls: turn.top_level_tool_calls,
    nested_mcp_calls: turn.nested_mcp_calls,
    web_searches: turn.web_searches,
    patches: turn.patches,
    compaction_raw_events: turn.compaction_raw_events,
    compaction_lifecycles: turn.compaction_lifecycles,
  };
}

function summarizeChat(turns) {
  const completed = turns.filter((turn) => turn.completed);
  const usage = sumUsage(turns);
  const utilization = turns
    .map((turn) => turn.context_utilization)
    .filter((value) => value !== null);
  const sum = (field) => turns.reduce((total, turn) => total + finite(turn[field]), 0);
  const latestCompleted = completed.at(-1) || null;
  const latest = turns.at(-1) || null;
  const latestMeasured = turns.findLast((turn) => turn.context_utilization !== null) || null;

  return {
    total_turns: turns.length,
    completed_turns: completed.length,
    active_turns: turns.filter((turn) => !turn.completed).length,
    duration_ms: sum("duration_ms"),
    context_window: latest?.model_context_window ?? null,
    latest_context_utilization: latestMeasured?.context_utilization ?? null,
    latest_completed_context_utilization: latestCompleted?.context_utilization ?? null,
    peak_context_utilization: utilization.length > 0 ? Math.max(...utilization) : null,
    ...usage,
    top_level_tool_calls: sum("top_level_tool_calls"),
    nested_mcp_calls: sum("nested_mcp_calls"),
    web_searches: sum("web_searches"),
    patches: sum("patches"),
    compaction_raw_events: sum("compaction_raw_events"),
    compaction_lifecycles: sum("compaction_lifecycles"),
    turns: turns.map(compactTurn),
  };
}

function analyze(args) {
  if (!["chat", "turn"].includes(args.scope)) fail(`Invalid scope: ${args.scope}`);
  if (!["latest", "latest-completed"].includes(args.turn)) fail(`Invalid turn selector: ${args.turn}`);

  const located = locateRollout(args);
  const parsed = parseRollout(located.file);
  const sessionMeta = parsed.rows.find((row) => row.type === "session_meta")?.payload || {};
  const turns = collectTurns(parsed.rows);
  if (turns.length === 0) fail("No Codex turns are available to analyze yet.");

  const result = {
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
    scope: args.scope,
    evidence: {
      observed: [
        "turn lifecycle",
        "token activity",
        "cache-read activity",
        "latest and peak context utilization",
        "top-level tool-call envelopes",
        "nested tool completion events",
        "compaction event types",
      ],
      inferred_or_missing: [
        "brief completeness",
        "information timing",
        "clarification necessity",
        "task trajectory",
        "digression intent",
        "avoidable rework",
        "context degradation",
      ],
    },
    limits: [
      "Cumulative input tokens measure activity across model requests, not the size of the current context.",
      "Cache-read ratio measures provider-reported token reuse; it does not prove that the reused context was relevant.",
      "Compaction lifecycles are deduplicated estimates because one compaction can emit multiple event types.",
      "Local rollout JSONL is an observed implementation detail, not a stable public integration API.",
      "Semantic PM judgments require visible conversation evidence and must be labeled as inferred.",
    ],
  };

  if (args.scope === "chat") result.chat = summarizeChat(turns);
  else {
    const eligible = args.turn === "latest" ? turns : turns.filter((turn) => turn.completed);
    if (eligible.length === 0) fail("No completed Codex turn is available to analyze yet.");
    result.turn = compactTurn(eligible.at(-1), turns.indexOf(eligible.at(-1)));
  }
  return result;
}

function percentage(value) {
  return value === null ? "unknown" : `${Math.round(value * 100)}%`;
}

function number(value) {
  return value === null ? "unknown" : new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function bar(value, width = 10) {
  if (value === null) return "░".repeat(width);
  const filled = Math.max(0, Math.min(width, Math.round(value * width)));
  return `${"█".repeat(filled)}${"░".repeat(width - filled)}`;
}

function markdown(result) {
  const data = result.scope === "chat" ? result.chat : result.turn;
  const latest = result.scope === "chat" ? data.latest_context_utilization : data.context_utilization;
  const peak = result.scope === "chat" ? data.peak_context_utilization : data.context_utilization;
  const turns = result.scope === "chat" ? `${data.total_turns} (${data.completed_turns} completed)` : `Turn ${data.sequence}`;
  const compactions = data.compaction_lifecycles;
  return `# PM Context Check · observed telemetry\n\n` +
    `| Signal | Reading |\n|---|---:|\n` +
    `| Turns | ${turns} |\n` +
    `| Latest context | \`${bar(latest)}\` ${percentage(latest)} |\n` +
    `| Peak context | \`${bar(peak)}\` ${percentage(peak)} |\n` +
    `| Input activity | ${number(data.input_tokens)} tokens |\n` +
    `| Cache reuse | ${percentage(data.cache_read_ratio)} |\n` +
    `| Fresh input | ${number(data.fresh_input_tokens)} tokens |\n` +
    `| Output | ${number(data.output_tokens)} tokens |\n` +
    `| Top-level tool calls | ${data.top_level_tool_calls} |\n` +
    `| Compaction lifecycles | ${compactions} |\n\n` +
    `> Metadata-only. Token totals are cumulative activity; semantic context quality is not inferred by this script.\n`;
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
