import * as fs from "node:fs/promises";
import * as path from "node:path";

const STABLE_VERSION_PATTERN = /^\d+\.\d+\.\d+$/u;
const PRERELEASE_PART_PATTERN = /^[0-9A-Za-z-]+$/u;

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

export function fail(message) {
  console.error(message);
  process.exit(1);
}

