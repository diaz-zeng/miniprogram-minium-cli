#!/usr/bin/env node

import * as fs from "node:fs/promises";
import * as path from "node:path";

import { ensureStableVersion, fail, parseArgs } from "./shared.mjs";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

const args = parseArgs(process.argv.slice(2));
const changelogPath = path.resolve(args.changelog ?? "CHANGELOG.md");
const version = ensureStableVersion(args.version, "release version");

const changelog = await fs.readFile(changelogPath, "utf8");
const headingPattern = new RegExp(
  String.raw`^## \[${escapeRegExp(version)}\](?: - .+)?$`,
  "mu",
);
const headingMatch = headingPattern.exec(changelog);

if (!headingMatch) {
  fail(
    `Could not find changelog entry for version ${version} in ${path.basename(changelogPath)}.`,
  );
}

const start = headingMatch.index;
const remaining = changelog.slice(start);
const nextHeadingMatch = /^## \[[^\]]+\](?: - .+)?$/mu.exec(remaining.slice(headingMatch[0].length));
const end =
  nextHeadingMatch === null
    ? changelog.length
    : start + headingMatch[0].length + nextHeadingMatch.index;

const section = changelog.slice(start, end).trim();
process.stdout.write(`${section}\n`);
