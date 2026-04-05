import * as path from "node:path";
import { promises as fs } from "node:fs";

export interface InstallBundledSkillsOptions {
  targetRoot?: string;
  cwd?: string;
  startDir?: string;
}

export interface InstalledSkill {
  name: string;
  sourceDir: string;
  targetDir: string;
}

export interface InstallBundledSkillsResult {
  targetRoot: string;
  packageRoot: string;
  installed: InstalledSkill[];
}

export class SkillInstallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillInstallError";
  }
}

export function resolveDefaultSkillTargetRoot(
  cwd: string = process.cwd(),
): string {
  return path.resolve(cwd, ".agents", "skills");
}

export async function installBundledSkills(
  options: InstallBundledSkillsOptions = {},
): Promise<InstallBundledSkillsResult> {
  const packageRoot = await findPackageRoot(options.startDir ?? __dirname);
  const bundledSkillsRoot = path.join(packageRoot, "skills");
  const installedSkillNames = await findBundledSkillNames(bundledSkillsRoot);
  if (installedSkillNames.length === 0) {
    throw new SkillInstallError(`No bundled skills found under ${bundledSkillsRoot}.`);
  }

  const targetRoot = path.resolve(options.targetRoot ?? resolveDefaultSkillTargetRoot(options.cwd));
  await fs.mkdir(targetRoot, { recursive: true });

  const installed: InstalledSkill[] = [];
  for (const skillName of installedSkillNames) {
    const sourceDir = path.join(bundledSkillsRoot, skillName);
    const targetDir = path.join(targetRoot, skillName);
    await fs.rm(targetDir, { recursive: true, force: true });
    await fs.cp(sourceDir, targetDir, { recursive: true, force: true });
    installed.push({
      name: skillName,
      sourceDir,
      targetDir,
    });
  }

  return {
    targetRoot,
    packageRoot,
    installed,
  };
}

async function findPackageRoot(startDir: string): Promise<string> {
  let currentDir = path.resolve(startDir);
  while (true) {
    const candidate = path.join(currentDir, "package.json");
    try {
      await fs.access(candidate);
      return currentDir;
    } catch {
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) {
        throw new SkillInstallError(`Could not locate package root from ${startDir}.`);
      }
      currentDir = parentDir;
    }
  }
}

async function findBundledSkillNames(skillsRoot: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(skillsRoot, { withFileTypes: true });
    const skillNames: string[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      const skillDir = path.join(skillsRoot, entry.name);
      try {
        await fs.access(path.join(skillDir, "SKILL.md"));
        skillNames.push(entry.name);
      } catch {
        // Ignore directories that are not valid skills.
      }
    }
    return skillNames.sort();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}
