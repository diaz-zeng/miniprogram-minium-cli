#!/usr/bin/env node

import {
  ensureStableVersion,
  fail,
  loadPackageJson,
  parseArgs,
  queryPublishedVersion,
} from "./shared.mjs";

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
    `Stable version ${packageName}@${version} is already published to npm. Update the release line version before attempting another stable release.`,
  );
}

process.stdout.write(`${version}\n`);
