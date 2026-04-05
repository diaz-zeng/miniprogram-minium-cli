import { main } from "./cli/main";

export { main };

export async function runCli(): Promise<void> {
  try {
    const exitCode = await main(process.argv.slice(2));
    process.exitCode = typeof exitCode === "number" ? exitCode : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  void runCli();
}
