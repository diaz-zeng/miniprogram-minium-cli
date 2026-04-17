import * as assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";
import { test } from "node:test";

const execFile = promisify(execFileCallback);
const repoRoot = path.resolve(__dirname, "..", "..");
const computeScript = path.join(repoRoot, "scripts", "release", "compute-prerelease-version.mjs");
const assertUnpublishedBaseScript = path.join(
  repoRoot,
  "scripts",
  "release",
  "assert-unpublished-base-version.mjs",
);
const assertReleaseBranchScript = path.join(
  repoRoot,
  "scripts",
  "release",
  "assert-release-branch-version.mjs",
);
const assertStableUnpublishedScript = path.join(
  repoRoot,
  "scripts",
  "release",
  "assert-stable-version-unpublished.mjs",
);
const extractChangelogScript = path.join(
  repoRoot,
  "scripts",
  "release",
  "extract-changelog-section.mjs",
);
const stageScript = path.join(repoRoot, "scripts", "release", "stage-package.mjs");

async function writePackageJson(targetDir: string, version: string) {
  const packageJson = {
    name: "fixture-package",
    version,
    files: ["lib/**/*", "README.md", "LICENSE"],
    scripts: {
      prepack: "node build.js",
      test: "node --test",
    },
  };

  await fs.writeFile(
    path.join(targetDir, "package.json"),
    `${JSON.stringify(packageJson, null, 2)}\n`,
    "utf8",
  );
}

test("compute-prerelease-version derives a unique beta version from a stable base", async () => {
  const fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), "minium-release-compute-"));

  try {
    await writePackageJson(fixtureDir, "1.3.0");

    const { stdout } = await execFile(process.execPath, [
      computeScript,
      "--package",
      path.join(fixtureDir, "package.json"),
      "--run-id",
      "456",
      "--run-attempt",
      "2",
      "--sha",
      "abcdef123456",
    ]);

    assert.equal(stdout.trim(), "1.3.0-beta.456.2.abcdef1");
  } finally {
    await fs.rm(fixtureDir, { recursive: true, force: true });
  }
});

test("compute-prerelease-version accepts a custom preid", async () => {
  const fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), "minium-release-compute-custom-preid-"));

  try {
    await writePackageJson(fixtureDir, "1.3.0");

    const { stdout } = await execFile(process.execPath, [
      computeScript,
      "--package",
      path.join(fixtureDir, "package.json"),
      "--preid",
      "preview-pr-42",
      "--run-id",
      "789",
      "--run-attempt",
      "3",
      "--sha",
      "1234567890ab",
    ]);

    assert.equal(stdout.trim(), "1.3.0-preview-pr-42.789.3.1234567");
  } finally {
    await fs.rm(fixtureDir, { recursive: true, force: true });
  }
});

test("assert-release-branch-version accepts a release branch that matches package version", async () => {
  const fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), "minium-release-branch-match-"));

  try {
    await writePackageJson(fixtureDir, "1.5.0");

    const { stdout } = await execFile(process.execPath, [
      assertReleaseBranchScript,
      "--package",
      path.join(fixtureDir, "package.json"),
      "--branch",
      "release/1.5.0",
    ]);

    assert.match(stdout, /kind=minor/);
    assert.match(stdout, /dist_tag=next/);
    assert.match(stdout, /prerelease_id=beta/);
  } finally {
    await fs.rm(fixtureDir, { recursive: true, force: true });
  }
});

test("assert-release-branch-version rejects mismatched branch versions", async () => {
  const fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), "minium-release-branch-mismatch-"));

  try {
    await writePackageJson(fixtureDir, "1.5.0");

    await assert.rejects(
      execFile(process.execPath, [
        assertReleaseBranchScript,
        "--package",
        path.join(fixtureDir, "package.json"),
        "--branch",
        "next/2.0.0",
      ]),
      /does not match package\.json version/,
    );
  } finally {
    await fs.rm(fixtureDir, { recursive: true, force: true });
  }
});

test("compute-prerelease-version rejects a prerelease base version", async () => {
  const fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), "minium-release-compute-invalid-"));

  try {
    await writePackageJson(fixtureDir, "1.3.0-beta.0");

    await assert.rejects(
      execFile(process.execPath, [
        computeScript,
        "--package",
        path.join(fixtureDir, "package.json"),
      ]),
      /stable semver version/,
    );
  } finally {
    await fs.rm(fixtureDir, { recursive: true, force: true });
  }
});

test("assert-unpublished-base-version succeeds when the stable version is not yet published", async () => {
  const fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), "minium-release-assert-base-missing-"));

  try {
    await writePackageJson(fixtureDir, "2.1.0");

    const { stdout } = await execFile(
      process.execPath,
      [assertUnpublishedBaseScript, "--package", path.join(fixtureDir, "package.json")],
      {
        env: {
          ...process.env,
          MINIUM_RELEASE_MOCK_NPM_VIEW_RESULT: "missing",
        },
      },
    );

    assert.equal(stdout.trim(), "2.1.0");
  } finally {
    await fs.rm(fixtureDir, { recursive: true, force: true });
  }
});

test("assert-unpublished-base-version rejects a stable version that is already published", async () => {
  const fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), "minium-release-assert-base-exists-"));

  try {
    await writePackageJson(fixtureDir, "2.1.0");

    await assert.rejects(
      execFile(
        process.execPath,
        [assertUnpublishedBaseScript, "--package", path.join(fixtureDir, "package.json")],
        {
          env: {
            ...process.env,
            MINIUM_RELEASE_MOCK_NPM_VIEW_RESULT: "exists",
          },
        },
      ),
      /already published to npm/,
    );
  } finally {
    await fs.rm(fixtureDir, { recursive: true, force: true });
  }
});

test("assert-stable-version-unpublished succeeds when the stable version is not yet published", async () => {
  const fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), "minium-release-validate-"));

  try {
    await writePackageJson(fixtureDir, "2.0.1");

    const { stdout } = await execFile(process.execPath, [
      assertStableUnpublishedScript,
      "--package",
      path.join(fixtureDir, "package.json"),
    ], {
      env: {
        ...process.env,
        MINIUM_RELEASE_MOCK_NPM_VIEW_RESULT: "missing",
      },
    });

    assert.equal(stdout.trim(), "2.0.1");
  } finally {
    await fs.rm(fixtureDir, { recursive: true, force: true });
  }
});

test("assert-stable-version-unpublished rejects an already-published stable version", async () => {
  const fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), "minium-release-validate-mismatch-"));

  try {
    await writePackageJson(fixtureDir, "2.0.1");

    await assert.rejects(
      execFile(process.execPath, [
        assertStableUnpublishedScript,
        "--package",
        path.join(fixtureDir, "package.json"),
      ], {
        env: {
          ...process.env,
          MINIUM_RELEASE_MOCK_NPM_VIEW_RESULT: "exists",
        },
      }),
      /already published to npm/,
    );
  } finally {
    await fs.rm(fixtureDir, { recursive: true, force: true });
  }
});

test("extract-changelog-section returns the requested release section", async () => {
  const fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), "minium-release-changelog-"));

  try {
    const changelogPath = path.join(fixtureDir, "CHANGELOG.md");
    await fs.writeFile(
      changelogPath,
      [
        "# Changelog",
        "",
        "## [Unreleased]",
        "",
        "## [1.5.0] - 2026-04-15",
        "",
        "### Added",
        "",
        "- New release flow.",
        "",
        "## [1.4.0] - 2026-04-01",
        "",
        "### Added",
        "",
        "- Previous release flow.",
        "",
      ].join("\n"),
      "utf8",
    );

    const { stdout } = await execFile(process.execPath, [
      extractChangelogScript,
      "--changelog",
      changelogPath,
      "--version",
      "1.5.0",
    ]);

    assert.match(stdout, /^## \[1\.5\.0\] - 2026-04-15/m);
    assert.match(stdout, /New release flow/);
    assert.doesNotMatch(stdout, /Previous release flow/);
  } finally {
    await fs.rm(fixtureDir, { recursive: true, force: true });
  }
});

test("extract-changelog-section rejects missing release sections", async () => {
  const fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), "minium-release-changelog-missing-"));

  try {
    const changelogPath = path.join(fixtureDir, "CHANGELOG.md");
    await fs.writeFile(changelogPath, "# Changelog\n\n## [1.4.0] - 2026-04-01\n", "utf8");

    await assert.rejects(
      execFile(process.execPath, [
        extractChangelogScript,
        "--changelog",
        changelogPath,
        "--version",
        "1.5.0",
      ]),
      /Could not find changelog entry/,
    );
  } finally {
    await fs.rm(fixtureDir, { recursive: true, force: true });
  }
});

test("stage-package creates an isolated publish directory without mutating the source package", async () => {
  const fixtureDir = await fs.mkdtemp(path.join(os.tmpdir(), "minium-release-stage-src-"));
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), "minium-release-stage-out-"));

  try {
    await writePackageJson(fixtureDir, "3.1.0");
    await fs.mkdir(path.join(fixtureDir, "lib"), { recursive: true });
    await fs.writeFile(path.join(fixtureDir, "lib", "index.js"), "console.log('fixture');\n", "utf8");
    await fs.writeFile(path.join(fixtureDir, "README.md"), "# Fixture\n", "utf8");
    await fs.writeFile(path.join(fixtureDir, "LICENSE"), "MIT\n", "utf8");

    const stagedDir = path.join(outputDir, "package");
    const { stdout } = await execFile(process.execPath, [
      stageScript,
      "--package",
      path.join(fixtureDir, "package.json"),
      "--version",
      "3.1.0-beta.10.1.deadbee",
      "--output-dir",
      stagedDir,
    ]);

    assert.equal(stdout.trim(), stagedDir);

    const stagedPackage = JSON.parse(await fs.readFile(path.join(stagedDir, "package.json"), "utf8")) as {
      version: string;
      scripts?: Record<string, string>;
    };
    const originalPackage = JSON.parse(await fs.readFile(path.join(fixtureDir, "package.json"), "utf8")) as {
      version: string;
      scripts?: Record<string, string>;
    };

    assert.equal(stagedPackage.version, "3.1.0-beta.10.1.deadbee");
    assert.equal(originalPackage.version, "3.1.0");
    assert.equal(stagedPackage.scripts?.prepack, undefined);
    assert.equal(originalPackage.scripts?.prepack, "node build.js");

    await fs.access(path.join(stagedDir, "lib", "index.js"));
    await fs.access(path.join(stagedDir, "README.md"));
    await fs.access(path.join(stagedDir, "LICENSE"));
  } finally {
    await fs.rm(fixtureDir, { recursive: true, force: true });
    await fs.rm(outputDir, { recursive: true, force: true });
  }
});
