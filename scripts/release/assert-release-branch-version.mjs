#!/usr/bin/env node

import {
  ensureStableVersion,
  fail,
  formatKeyValueOutput,
  loadPackageJson,
  parseArgs,
  parseReleaseBranch,
} from "./shared.mjs";

const args = parseArgs(process.argv.slice(2));
const packagePath = args.package ?? "package.json";
const branch = args.branch ?? process.env.GITHUB_REF_NAME ?? "";

const releaseBranch = parseReleaseBranch(branch, "release branch");
const { packageJson } = await loadPackageJson(packagePath);
const packageVersion = ensureStableVersion(packageJson.version, "package.json version");

if (packageVersion !== releaseBranch.version) {
  fail(
    `Release branch ${releaseBranch.branch} does not match package.json version ${packageVersion}. Expected ${releaseBranch.version}.`,
  );
}

process.stdout.write(
  `${formatKeyValueOutput({
    branch: releaseBranch.branch,
    prefix: releaseBranch.prefix,
    version: releaseBranch.version,
    kind: releaseBranch.kind,
    prerelease_id: releaseBranch.prereleaseId ?? "",
    dist_tag: releaseBranch.distTag,
  })}\n`,
);
