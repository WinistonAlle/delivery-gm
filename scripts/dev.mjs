import "dotenv/config";
import { spawn } from "node:child_process";

const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";

function runProcess(name, command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    env: {
      ...process.env,
      ...extraEnv,
    },
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      console.log(`[${name}] exited with signal ${signal}`);
    } else if (code && code !== 0) {
      console.log(`[${name}] exited with code ${code}`);
      process.exitCode = code;
    }
  });

  return child;
}

const backend = runProcess(
  "api",
  npmCmd,
  ["run", "start:prod"],
  { PORT: process.env.API_PORT || "4175" }
);

const frontend = runProcess("vite", npmCmd, ["run", "dev:vite"]);

function shutdown() {
  backend.kill("SIGTERM");
  frontend.kill("SIGTERM");
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
