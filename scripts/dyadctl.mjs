#!/usr/bin/env node
// dyadctl — headless Dyad governance runner. Plain Node ESM with zero repo
// imports so it can drive a governed verification pass without Electron.
//
// Usage:
//   node scripts/dyadctl.mjs run --app <dir> [--prompt <str|->] [--json]
//
// Reads <dir>/.dyad/specs/bundle.json (if present), flattens stories into
// verification contracts, and runs each contract as a shell command in the
// app directory with a 30s timeout. The --prompt flag (a literal string or
// `-` for stdin) and local model configuration from the environment are
// accepted but unused in v1.

import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const CONTRACT_TIMEOUT_MS = 30_000;

function parseArgs(argv) {
  const args = { app: null, prompt: null, json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--app") {
      args.app = argv[++i] ?? null;
    } else if (arg === "--prompt") {
      args.prompt = argv[++i] ?? null;
    } else if (arg === "--json") {
      args.json = true;
    }
  }
  return args;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8").trimEnd();
}

function runContract(command, cwd) {
  return new Promise((resolve) => {
    const child = spawn("sh", ["-c", command], { cwd });
    let settled = false;
    const finish = (outcome) => {
      if (!settled) {
        settled = true;
        resolve(outcome);
      }
    };
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ status: "timeout", exitCode: null });
    }, CONTRACT_TIMEOUT_MS);
    child.on("close", (code) => {
      clearTimeout(timer);
      finish({ status: code === 0 ? "green" : "red", exitCode: code });
    });
  });
}

function flattenContracts(bundle) {
  const contracts = [];
  for (const story of bundle.stories ?? []) {
    for (const criterion of story.criteria ?? []) {
      if (criterion.verificationContract) {
        contracts.push({
          key: `${story.id}/${criterion.id}`,
          command: criterion.verificationContract,
        });
      }
    }
  }
  return contracts;
}

async function main(argv) {
  const [command, ...rest] = argv;
  if (command !== "run") {
    console.error("usage: dyadctl run --app <dir> [--prompt <str|->] [--json]");
    process.exitCode = 1;
    return;
  }
  const args = parseArgs(rest);
  if (!args.app) {
    console.error("--app is required");
    process.exitCode = 1;
    return;
  }
  // Accepted-but-unused in v1: the prompt (or stdin when `-`) and local model
  // configuration from the environment will drive real runs in a later phase.
  if (args.prompt === "-") {
    await readStdin();
  }

  let verifications = [];
  try {
    const raw = await readFile(
      join(args.app, ".dyad", "specs", "bundle.json"),
      "utf8",
    );
    const contracts = flattenContracts(JSON.parse(raw));
    for (const contract of contracts) {
      const outcome = await runContract(contract.command, args.app);
      verifications.push({
        key: contract.key,
        status: outcome.status,
        exitCode: outcome.exitCode,
      });
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
    // No bundle on disk → nothing to verify.
  }

  process.stdout.write(
    `${JSON.stringify({ status: "completed", verifications, versions: [] })}\n`,
  );
}

main(process.argv.slice(2));
