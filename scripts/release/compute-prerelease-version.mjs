#!/usr/bin/env node

import {
  ensureStableVersion,
  loadPackageJson,
  parseArgs,
  sanitizePrereleasePart,
} from "./shared.mjs";

const args = parseArgs(process.argv.slice(2));
const packagePath = args.package ?? "package.json";
const preid = sanitizePrereleasePart(args.preid, "beta");
const runId = sanitizePrereleasePart(args["run-id"] ?? process.env.GITHUB_RUN_ID, "0");
const runAttempt = sanitizePrereleasePart(
  args["run-attempt"] ?? process.env.GITHUB_RUN_ATTEMPT,
  "0",
);
const rawSha = (args.sha ?? process.env.GITHUB_SHA ?? "local").trim().toLowerCase();
const sha = sanitizePrereleasePart(rawSha.slice(0, 7), "local");

const { packageJson } = await loadPackageJson(packagePath);
const baseVersion = ensureStableVersion(packageJson.version, "package.json version");

process.stdout.write(`${baseVersion}-${preid}.${runId}.${runAttempt}.${sha}\n`);

