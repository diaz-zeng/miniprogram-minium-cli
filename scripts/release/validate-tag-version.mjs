#!/usr/bin/env node

import { ensureStableVersion, fail, loadPackageJson, parseArgs } from "./shared.mjs";

const args = parseArgs(process.argv.slice(2));
const packagePath = args.package ?? "package.json";
const tag = (args.tag ?? process.env.GITHUB_REF_NAME ?? "").trim();

if (tag.length === 0) {
  fail("Missing tag name. Pass --tag <tag> or set GITHUB_REF_NAME.");
}

if (!tag.startsWith("v")) {
  fail(`Release tag must start with "v". Received: ${tag}`);
}

const expectedVersion = tag.slice(1);
ensureStableVersion(expectedVersion, "release tag version");

const { packageJson } = await loadPackageJson(packagePath);
const packageVersion = ensureStableVersion(packageJson.version, "package.json version");

if (packageVersion !== expectedVersion) {
  fail(
    `Release tag ${tag} does not match package.json version ${packageVersion}. Update one of them before publishing.`,
  );
}

process.stdout.write(`${packageVersion}\n`);

