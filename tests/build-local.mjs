import { spawn } from "node:child_process";
import { localAppEnv } from "./local-env.mjs";
const child = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "build"],
  { stdio: "inherit", env: localAppEnv() },
);
child.on("exit", (code) => process.exit(code ?? 1));
