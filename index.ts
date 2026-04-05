#!/usr/bin/env node

import { main } from "./src/cli/main";

async function run(): Promise<void> {
  try {
    const exitCode = await main(process.argv.slice(2));
    process.exitCode = typeof exitCode === "number" ? exitCode : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

void run();
