import * as fs from "node:fs/promises";
import * as path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

const STABLE_VERSION_PATTERN = /^\d+\.\d+\.\d+$/u;
const PRERELEASE_PART_PATTERN = /^[0-9A-Za-z-]+$/u;
const RELEASE_BRANCH_PATTERN = /^(next|release|hotfix)\/(\d+\.\d+\.\d+)$/u;
const NOT_PUBLISHED_PATTERN = /E404|404 Not Found|No match found for version|is not in this registry/u;
const execFile = promisify(execFileCallback);

export function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith("--")) {
      args[key] = "true";
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

export async function loadPackageJson(packagePath) {
  const resolvedPath = path.resolve(packagePath);
  const content = await fs.readFile(resolvedPath, "utf8");

  return {
    packagePath: resolvedPath,
    packageDir: path.dirname(resolvedPath),
    packageJson: JSON.parse(content),
  };
}

export function ensureStableVersion(version, context) {
  if (!STABLE_VERSION_PATTERN.test(version)) {
    fail(
      `${context} must be a stable semver version like 1.3.0. Received: ${version}`,
    );
  }

  return version;
}

export function sanitizePrereleasePart(value, fallback) {
  const candidate = (value ?? fallback ?? "").trim();
  if (candidate.length === 0) {
    fail("Expected a prerelease identifier component but received an empty value.");
  }

  if (!PRERELEASE_PART_PATTERN.test(candidate)) {
    fail(
      `Invalid prerelease identifier component: ${candidate}. Only letters, digits, and hyphens are supported.`,
    );
  }

  return candidate;
}

export function parseReleaseBranch(branchRef, context = "branch ref") {
  const candidate = (branchRef ?? "").trim();
  const match = RELEASE_BRANCH_PATTERN.exec(candidate);
  if (!match) {
    fail(
      `${context} must match next/x.y.z, release/x.y.z, or hotfix/x.y.z. Received: ${candidate || "<empty>"}`,
    );
  }

  const [, prefix, version] = match;
  const kind =
    prefix === "next" ? "major" : prefix === "release" ? "minor" : "patch";
  const prereleaseId =
    prefix === "next" ? "alpha" : prefix === "release" ? "beta" : null;
  const distTag =
    prefix === "next" ? "alpha" : prefix === "release" ? "next" : "latest";

  return {
    branch: candidate,
    prefix,
    version,
    kind,
    prereleaseId,
    distTag,
  };
}

export function formatKeyValueOutput(values) {
  return Object.entries(values)
    .map(([key, value]) => `${key}=${value ?? ""}`)
    .join("\n");
}

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

export async function queryPublishedVersion(packageName, version, registry) {
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

export function fail(message) {
  console.error(message);
  process.exit(1);
}
