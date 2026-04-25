#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const REQUEST_ID_ARRAY_KEYS = new Set([
  "matchedRequestIds",
  "removedRequestIds",
  "requestIds",
  "sampleRequestIds",
]);

const LISTENER_ID_ARRAY_KEYS = new Set([
  "listenerIds",
  "removedListenerIds",
]);

const INTERCEPT_ID_ARRAY_KEYS = new Set([
  "interceptIds",
  "removedInterceptIds",
]);

const EVENT_ID_ARRAY_KEYS = new Set([
  "eventIds",
  "matchedEventIds",
  "removedEventIds",
]);

const HELP_TEXT = `Usage:
  node skills/miniprogram-minium-cli/scripts/filter-network-artifact.mjs --result <result.json> [--network <network.json>] [--step-id <id>] [--pretty]

Options:
  --result, -r     Path to result.json
  --network, -n    Optional path to network.json
  --step-id, -s    Optional step id filter, can be provided multiple times
  --pretty         Pretty-print JSON output
  --help, -h       Show this help
`;

export async function main(argv = process.argv.slice(2)) {
  try {
    const options = parseArguments(argv);
    if (options.help) {
      process.stdout.write(HELP_TEXT);
      return 0;
    }

    const resultPath = resolveInputPath(options.resultPath);
    const resultPayload = await readJsonFile(resultPath, "result.json");
    const networkPath = await resolveNetworkArtifactPath(resultPayload, options.networkPath);
    const networkPayload = await readJsonFile(networkPath, "network.json");
    const filteredPayload = buildFilteredNetworkArtifact({
      networkPath,
      networkPayload,
      requestedStepIds: options.stepIds,
      resultPath,
      resultPayload,
    });

    process.stdout.write(JSON.stringify(filteredPayload, null, options.pretty ? 2 : 0));
    process.stdout.write("\n");
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    return 1;
  }
}

function parseArguments(argv) {
  const options = {
    help: false,
    networkPath: undefined,
    pretty: false,
    resultPath: undefined,
    stepIds: [],
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    switch (argument) {
      case "--help":
      case "-h":
        options.help = true;
        break;
      case "--pretty":
        options.pretty = true;
        break;
      case "--result":
      case "-r":
        options.resultPath = getRequiredValue(argv, index, argument);
        index += 1;
        break;
      case "--network":
      case "-n":
        options.networkPath = getRequiredValue(argv, index, argument);
        index += 1;
        break;
      case "--step-id":
      case "-s":
        options.stepIds.push(getRequiredValue(argv, index, argument));
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${argument}`);
    }
  }

  if (!options.help && !options.resultPath) {
    throw new Error("Missing required --result argument");
  }

  return options;
}

function getRequiredValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`Missing value for ${flag}`);
  }

  return value;
}

function resolveInputPath(inputPath) {
  return path.resolve(process.cwd(), inputPath);
}

async function readJsonFile(filePath, label) {
  try {
    const content = await readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`${label} is not valid JSON: ${filePath}`, {
        cause: error,
      });
    }

    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(`Could not find ${label}: ${filePath}`, {
        cause: error,
      });
    }

    throw new Error(`Failed to read ${label}: ${filePath}`, {
      cause: error,
    });
  }
}

export async function resolveNetworkArtifactPath(resultPayload, explicitNetworkPath) {
  if (explicitNetworkPath) {
    return resolveInputPath(explicitNetworkPath);
  }

  const candidates = new Set();
  if (typeof resultPayload?.artifacts?.networkPath === "string" && resultPayload.artifacts.networkPath.length > 0) {
    candidates.add(path.resolve(process.cwd(), resultPayload.artifacts.networkPath));
  }

  const stepResults = Array.isArray(resultPayload?.stepResults) ? resultPayload.stepResults : [];
  for (const stepResult of stepResults) {
    const evidenceList = stepResult?.details?.networkEvidence;
    if (!Array.isArray(evidenceList)) {
      continue;
    }

    for (const evidence of evidenceList) {
      if (typeof evidence?.artifactPath === "string" && evidence.artifactPath.length > 0) {
        candidates.add(path.resolve(process.cwd(), evidence.artifactPath));
      }
    }
  }

  if (candidates.size === 0) {
    throw new Error("Could not infer network.json from result.json; pass --network explicitly");
  }

  if (candidates.size > 1) {
    throw new Error("Detected multiple network.json candidates; pass --network explicitly");
  }

  return Array.from(candidates)[0];
}

export function buildFilteredNetworkArtifact({
  networkPath,
  networkPayload,
  requestedStepIds = [],
  resultPath,
  resultPayload,
}) {
  const stepResults = Array.isArray(resultPayload?.stepResults) ? resultPayload.stepResults : [];
  const stepsWithEvidence = stepResults.filter((step) =>
    Array.isArray(step?.details?.networkEvidence) && step.details.networkEvidence.length > 0);
  const selectedSteps = selectSteps(stepResults, requestedStepIds);

  const eventMap = new Map(Array.isArray(networkPayload?.events)
    ? networkPayload.events
      .filter((event) => event && typeof event.eventId === "string")
      .map((event) => [event.eventId, event])
    : []);
  const requestMap = new Map(Object.entries(networkPayload?.requests ?? {}));
  const listenerMap = new Map(Object.entries(networkPayload?.listeners ?? {}));
  const interceptMap = new Map(Object.entries(networkPayload?.intercepts ?? {}));

  const state = createSelectionState(eventMap, requestMap, listenerMap, interceptMap);
  for (const step of selectedSteps) {
    for (const evidence of step.details.networkEvidence) {
      addNetworkEvidence(state, evidence);
    }
  }

  drainSelectionState(state);

  if (
    state.eventIds.size === 0
    && state.requestIds.size === 0
    && state.listenerIds.size === 0
    && state.interceptIds.size === 0
  ) {
    throw new Error("Could not resolve any linked network entities from networkEvidence");
  }

  const filteredEvents = Array.isArray(networkPayload?.events)
    ? networkPayload.events.filter((event) => state.eventIds.has(event.eventId))
    : [];
  const filteredRequests = filterRecordObject(networkPayload?.requests, state.requestIds);
  const filteredListeners = filterRecordObject(networkPayload?.listeners, state.listenerIds);
  const filteredIntercepts = filterRecordObject(networkPayload?.intercepts, state.interceptIds);

  const totalCounts = {
    events: Array.isArray(networkPayload?.events) ? networkPayload.events.length : 0,
    intercepts: Object.keys(networkPayload?.intercepts ?? {}).length,
    listeners: Object.keys(networkPayload?.listeners ?? {}).length,
    requests: Object.keys(networkPayload?.requests ?? {}).length,
  };

  const selectedStepSummaries = selectedSteps.map((step) => ({
    id: step.id,
    networkEvidence: step.details.networkEvidence,
    status: step.status,
    type: step.type,
  }));

  return {
    schemaVersion: typeof networkPayload?.schemaVersion === "number" ? networkPayload.schemaVersion : null,
    events: filteredEvents,
    requests: filteredRequests,
    listeners: filteredListeners,
    intercepts: filteredIntercepts,
    meta: {
      omittedCounts: {
        events: totalCounts.events - filteredEvents.length,
        intercepts: totalCounts.intercepts - Object.keys(filteredIntercepts).length,
        listeners: totalCounts.listeners - Object.keys(filteredListeners).length,
        requests: totalCounts.requests - Object.keys(filteredRequests).length,
      },
      paths: {
        network: networkPath,
        result: resultPath,
      },
      selectedCounts: {
        evidence: selectedStepSummaries.reduce((count, step) => count + step.networkEvidence.length, 0),
        events: filteredEvents.length,
        intercepts: Object.keys(filteredIntercepts).length,
        listeners: Object.keys(filteredListeners).length,
        requests: Object.keys(filteredRequests).length,
      },
      selectedStepIds: selectedStepSummaries.map((step) => step.id),
      selectedSteps: selectedStepSummaries,
      stepsWithEvidenceCount: stepsWithEvidence.length,
      totalCounts,
    },
  };
}

function selectSteps(stepResults, requestedStepIds) {
  if (!Array.isArray(stepResults)) {
    throw new Error("result.json is missing stepResults");
  }

  if (requestedStepIds.length === 0) {
    const selectedSteps = stepResults.filter((step) =>
      Array.isArray(step?.details?.networkEvidence) && step.details.networkEvidence.length > 0);
    if (selectedSteps.length === 0) {
      throw new Error("result.json does not contain any networkEvidence entries");
    }

    return selectedSteps;
  }

  const stepMap = new Map(stepResults
    .filter((step) => typeof step?.id === "string")
    .map((step) => [step.id, step]));
  const missingStepIds = requestedStepIds.filter((stepId) => !stepMap.has(stepId));
  if (missingStepIds.length > 0) {
    throw new Error(`Could not find step(s) in result.json: ${missingStepIds.join(", ")}`);
  }

  const selectedSteps = stepResults.filter((step) => requestedStepIds.includes(step.id));
  const stepsWithoutEvidence = selectedSteps
    .filter((step) => !Array.isArray(step?.details?.networkEvidence) || step.details.networkEvidence.length === 0)
    .map((step) => step.id);
  if (stepsWithoutEvidence.length > 0) {
    throw new Error(`Step(s) do not contain networkEvidence: ${stepsWithoutEvidence.join(", ")}`);
  }

  return selectedSteps;
}

function createSelectionState(eventMap, requestMap, listenerMap, interceptMap) {
  return {
    eventIds: new Set(),
    eventMap,
    eventQueue: [],
    interceptIds: new Set(),
    interceptMap,
    interceptQueue: [],
    listenerIds: new Set(),
    listenerMap,
    listenerQueue: [],
    requestIds: new Set(),
    requestMap,
    requestQueue: [],
  };
}

function addNetworkEvidence(state, evidence) {
  addEventId(state, evidence?.eventId);
  addRequestId(state, evidence?.requestId);
  addListenerId(state, evidence?.listenerId);
  addInterceptId(state, evidence?.interceptId);
}

function addEventId(state, eventId) {
  if (typeof eventId !== "string" || state.eventIds.has(eventId) || !state.eventMap.has(eventId)) {
    return;
  }

  state.eventIds.add(eventId);
  state.eventQueue.push(eventId);
}

function addRequestId(state, requestId) {
  if (typeof requestId !== "string" || state.requestIds.has(requestId) || !state.requestMap.has(requestId)) {
    return;
  }

  state.requestIds.add(requestId);
  state.requestQueue.push(requestId);
}

function addListenerId(state, listenerId) {
  if (typeof listenerId !== "string" || state.listenerIds.has(listenerId) || !state.listenerMap.has(listenerId)) {
    return;
  }

  state.listenerIds.add(listenerId);
  state.listenerQueue.push(listenerId);
}

function addInterceptId(state, interceptId) {
  if (typeof interceptId !== "string" || state.interceptIds.has(interceptId) || !state.interceptMap.has(interceptId)) {
    return;
  }

  state.interceptIds.add(interceptId);
  state.interceptQueue.push(interceptId);
}

function drainSelectionState(state) {
  while (
    state.eventQueue.length > 0
    || state.requestQueue.length > 0
    || state.listenerQueue.length > 0
    || state.interceptQueue.length > 0
  ) {
    while (state.eventQueue.length > 0) {
      processEventRecord(state, state.eventQueue.shift());
    }

    while (state.requestQueue.length > 0) {
      processRequestRecord(state, state.requestQueue.shift());
    }

    while (state.listenerQueue.length > 0) {
      processListenerRecord(state, state.listenerQueue.shift());
    }

    while (state.interceptQueue.length > 0) {
      processInterceptRecord(state, state.interceptQueue.shift());
    }
  }
}

function processEventRecord(state, eventId) {
  const event = state.eventMap.get(eventId);
  if (!event) {
    return;
  }

  addRequestId(state, event.requestId);
  addListenerId(state, event.listenerId);
  addInterceptId(state, event.interceptId);

  const linkedIds = extractLinkedIdsFromEventData(event.data);
  for (const requestId of linkedIds.requestIds) {
    addRequestId(state, requestId);
  }
  for (const listenerId of linkedIds.listenerIds) {
    addListenerId(state, listenerId);
  }
  for (const interceptId of linkedIds.interceptIds) {
    addInterceptId(state, interceptId);
  }
  for (const linkedEventId of linkedIds.eventIds) {
    addEventId(state, linkedEventId);
  }
}

function processRequestRecord(state, requestId) {
  const record = state.requestMap.get(requestId);
  if (!record) {
    return;
  }

  for (const eventId of ensureStringArray(record.eventIds)) {
    addEventId(state, eventId);
  }
  for (const listenerId of ensureStringArray(record.listenerIds)) {
    addListenerId(state, listenerId);
  }
  for (const interceptId of ensureStringArray(record.interceptIds)) {
    addInterceptId(state, interceptId);
  }
}

function processListenerRecord(state, listenerId) {
  const record = state.listenerMap.get(listenerId);
  if (!record) {
    return;
  }

  for (const eventId of ensureStringArray(record.eventIds)) {
    addEventId(state, eventId);
  }
}

function processInterceptRecord(state, interceptId) {
  const record = state.interceptMap.get(interceptId);
  if (!record) {
    return;
  }

  for (const eventId of ensureStringArray(record.eventIds)) {
    addEventId(state, eventId);
  }
}

function extractLinkedIdsFromEventData(data) {
  const linkedIds = {
    eventIds: [],
    interceptIds: [],
    listenerIds: [],
    requestIds: [],
  };

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return linkedIds;
  }

  for (const [key, value] of Object.entries(data)) {
    if (REQUEST_ID_ARRAY_KEYS.has(key)) {
      linkedIds.requestIds.push(...ensureStringArray(value));
      continue;
    }

    if (LISTENER_ID_ARRAY_KEYS.has(key)) {
      linkedIds.listenerIds.push(...ensureStringArray(value));
      continue;
    }

    if (INTERCEPT_ID_ARRAY_KEYS.has(key)) {
      linkedIds.interceptIds.push(...ensureStringArray(value));
      continue;
    }

    if (EVENT_ID_ARRAY_KEYS.has(key)) {
      linkedIds.eventIds.push(...ensureStringArray(value));
      continue;
    }

    if (key === "requestId" && typeof value === "string") {
      linkedIds.requestIds.push(value);
      continue;
    }

    if (key === "listenerId" && typeof value === "string") {
      linkedIds.listenerIds.push(value);
      continue;
    }

    if (key === "interceptId" && typeof value === "string") {
      linkedIds.interceptIds.push(value);
      continue;
    }

    if (key === "eventId" && typeof value === "string") {
      linkedIds.eventIds.push(value);
    }
  }

  return linkedIds;
}

function ensureStringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function filterRecordObject(recordObject, selectedIds) {
  return Object.fromEntries(
    Object.entries(recordObject ?? {}).filter(([recordId]) => selectedIds.has(recordId)),
  );
}

function isDirectEntrypoint(metaUrl, argvPath) {
  if (!argvPath) {
    return false;
  }
  const metaPath = fileURLToPath(metaUrl);
  const resolvedArgvPath = path.resolve(argvPath);
  try {
    return realpathSync(metaPath) === realpathSync(resolvedArgvPath);
  } catch {
    return metaPath === resolvedArgvPath;
  }
}

if (isDirectEntrypoint(import.meta.url, process.argv[1])) {
  const exitCode = await main();
  process.exitCode = exitCode;
}
