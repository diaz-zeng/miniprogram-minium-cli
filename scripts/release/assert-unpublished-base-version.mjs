#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

import { ensureStableVersion, fail, loadPackageJson, parseArgs } from "./shared.mjs";

const execFile = promisify(execFileCallback);
const NOT_PUBLISHED_PATTERN = /E404|404 Not Found|No match found for version|is not in this registry/u;

function parsePublishedVersion(stdout) {
  const trimmed = stdout.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    return typeof parsed === "string" ? parsed : null;
  } catch {
    return trimmed;
  }
}

async function queryPublishedVersion(packageName, version, registry) {
  const mockedResult = process.env.MINIUM_RELEASE_MOCK_NPM_VIEW_RESULT?.trim();
  if (mockedResult === "exists") {
    return version;
  }
  if (mockedResult === "missing") {
    return null;
  }
  if (mockedResult) {
    fail(
      `Unsupported MINIUM_RELEASE_MOCK_NPM_VIEW_RESULT value: ${mockedResult}. Expected "exists" or "missing".`,
    );
  }

  try {
    const { stdout } = await execFile("npm", [
      "view",
      `${packageName}@${version}`,
      "version",
      "--json",
      "--registry",
      registry,
    ]);
    return parsePublishedVersion(stdout);
  } catch (error) {
    const details = `${error.stdout ?? ""}\n${error.stderr ?? ""}`.trim();
    if (NOT_PUBLISHED_PATTERN.test(details)) {
      return null;
    }

    fail(
      `Failed to query npm registry for ${packageName}@${version}. ${details || error.message}`,
    );
  }
}

const args = parseArgs(process.argv.slice(2));
const packagePath = args.package ?? "package.json";
const registry =
  args.registry ??
  process.env.npm_config_registry ??
  process.env.NPM_CONFIG_REGISTRY ??
  "https://registry.npmjs.org";

const { packageJson } = await loadPackageJson(packagePath);
const packageName = packageJson.name;
const version = ensureStableVersion(packageJson.version, "package.json version");

if (typeof packageName !== "string" || packageName.trim().length === 0) {
  fail("package.json name must be a non-empty string.");
}

const publishedVersion = await queryPublishedVersion(packageName, version, registry);
if (publishedVersion === version) {
  fail(
    `Stable version ${packageName}@${version} is already published to npm. Bump package.json.version to the next intended stable release before publishing beta or canary builds.`,
  );
}

process.stdout.write(`${version}\n`);
