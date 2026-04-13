#!/usr/bin/env node

import * as fs from "node:fs/promises";
import * as path from "node:path";

import { fail, loadPackageJson, parseArgs } from "./shared.mjs";

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function collectTopLevelEntries(packageJson) {
  const entries = new Set(["package.json"]);

  for (const item of packageJson.files ?? []) {
    const normalized = item.replace(/^\.\/+/u, "");
    const [topLevel] = normalized.split("/");
    if (topLevel) {
      entries.add(topLevel);
    }
  }

  return [...entries];
}

const args = parseArgs(process.argv.slice(2));
const packagePath = args.package ?? "package.json";
const outputDir = args["output-dir"];
const targetVersion = args.version;

if (!outputDir) {
  fail("Missing --output-dir for staged release package.");
}

if (!targetVersion) {
  fail("Missing --version for staged release package.");
}

const { packagePath: resolvedPackagePath, packageDir, packageJson } = await loadPackageJson(packagePath);
const stagedDir = path.resolve(outputDir);

await fs.rm(stagedDir, { recursive: true, force: true });
await fs.mkdir(stagedDir, { recursive: true });

for (const entry of collectTopLevelEntries(packageJson)) {
  const sourcePath = path.resolve(packageDir, entry);
  const targetPath = path.join(stagedDir, entry);

  if (!(await pathExists(sourcePath))) {
    continue;
  }

  await fs.cp(sourcePath, targetPath, { recursive: true });
}

const stagedPackagePath = path.join(stagedDir, "package.json");
const stagedPackageJson = {
  ...packageJson,
  version: targetVersion,
  scripts: {
    ...packageJson.scripts,
  },
};

delete stagedPackageJson.scripts?.prepack;
if (stagedPackageJson.scripts && Object.keys(stagedPackageJson.scripts).length === 0) {
  delete stagedPackageJson.scripts;
}

await fs.writeFile(stagedPackagePath, `${JSON.stringify(stagedPackageJson, null, 2)}\n`, "utf8");
process.stdout.write(`${stagedDir}\n`);

