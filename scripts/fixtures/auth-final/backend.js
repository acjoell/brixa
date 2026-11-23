import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomInt, randomUUID } from "node:crypto";
import { copyFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { URL } from "node:url";
import { executeCommand } from "../../mutation-engine.js";
import { startBackendServer, stopProcess } from "../../verify-generated.js";
import { adminEmail, authClient, checkCookieIsolation } from "./http-probe.js";

const numberOfPairs = 100;
const incorrect = "wrong test credential";

function quantiles(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (fraction) => +sorted[Math.floor((sorted.length - 1) * fraction)].toFixed(3);
  return { p05: at(0.05), median: at(0.5), p95: at(0.95) };
}

async function compareTiming(client, signal) {
  const emails = [adminEmail, "ghost@example.test"];
  let rejection;
  async function measure(index) {
    signal?.throwIfAborted();
    const start = performance.now();
    const response = await client.login(emails[index], incorrect);
    const body = await response.text();
    const elapsed = performance.now() - start;
    assert.equal(response.status, 401, "Las muestras deben ser rechazos de credenciales.");
    assert.equal(response.headers.get("retry-after"), null);
    assert.equal(response.headers.get("set-cookie"), null);
    rejection ??= body;
    assert.equal(body, rejection);
    return elapsed;
  }
  for (let warmup = 0; warmup < 10; warmup++) {
    await measure(0);
    await measure(1);
  }

  const existing = [];
  const missing = [];
  for (let pair = 0; pair < numberOfPairs; pair++) {
    if (randomInt(2) === 0) {
      existing.push(await measure(0));
      missing.push(await measure(1));
    } else {
      missing.push(await measure(1));
      existing.push(await measure(0));
    }
  }
  const differences = existing.map((value, index) => value - missing[index]);
  const bootstrap = Array.from(
    { length: 2000 },
    () => quantiles(differences.map(() => differences[randomInt(numberOfPairs)])).median,
  ).sort((a, b) => a - b);
  console.log("Temporización HTTP local (ms)", {
    pairs: numberOfPairs,
    existing: quantiles(existing),
    missing: quantiles(missing),
    pairedDifference: quantiles(differences),
    medianBootstrap95: [bootstrap[50], bootstrap[1949]],
  });
}

async function checkMemory(directory, env, signal) {
  const image = process.env.BRIXA_AUTH_NODE_IMAGE;
  assert(
    image,
    "BRIXA_AUTH_NODE_IMAGE debe identificar una imagen Node 24 local compatible con el host.",
  );
  const container = "brixa-auth-memory-" + randomUUID();
  await copyFile(
    new URL("./http-probe.js", import.meta.url),
    path.join(directory, ".http-probe.js"),
  );
  const limit = 256 * 1024 * 1024;
  const docker = (args, extraEnv) =>
    execFileSync("docker", args, {
      encoding: "utf8",
      timeout: 20_000,
      env: { ...process.env, ...extraEnv },
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  try {
    signal?.throwIfAborted();
    const containerEnv = {
      ...Object.fromEntries(Object.entries(env).filter(([, value]) => value !== undefined)),
      DATABASE_URL: "file:/workspace/auth.db",
      LOGIN_IP_REQUEST_LIMIT: "100",
      PORT: "3000",
    };
    // El archivo SQLite está junto al proyecto. Ambos montajes son temporales.
    docker(
      [
        "run",
        "-d",
        "--name",
        container,
        "--pull=never",
        "--network=none",
        "--memory=256m",
        "--memory-swap=256m",
        "--cpus=1",
        "--user",
        process.getuid() + ":" + process.getgid(),
        "-v",
        path.dirname(directory) + ":/workspace",
        "-w",
        "/workspace/" + path.basename(directory),
        ...Object.keys(containerEnv).flatMap((key) => ["-e", key]),
        "--entrypoint",
        "node",
        image,
        "src/index.js",
      ],
      containerEnv,
    );
    const result = await executeCommand(
      "docker",
      ["exec", container, "node", ".http-probe.js", "--memory"],
      directory,
      {
        signal,
        timeoutMs: 35_000,
      },
    );
    signal?.throwIfAborted();
    if (result.exitCode !== 0) {
      const reason = result.stderr.match(/AssertionError[^\n]*/)?.[0] ?? result.signal;
      const line = result.stderr.match(/\.http-probe\.js:(\d+)/)?.[1];
      const state = docker([
        "inspect",
        "-f",
        "{{.State.Status}}/{{.State.ExitCode}}/{{.State.OOMKilled}}",
        container,
      ]);
      throw new Error(`Falló la ráfaga HTTP (${state}, línea ${line}): ${reason}`);
    }
    const [max, peak, rss, oom, oomKill] = docker([
      "exec",
      container,
      "sh",
      "-c",
      "cat /sys/fs/cgroup/memory.max /sys/fs/cgroup/memory.peak; awk '/^VmHWM:/ {print $2}' /proc/1/status; awk '$1==\"oom\" || $1==\"oom_kill\" {print $2}' /sys/fs/cgroup/memory.events",
    ])
      .split(/\s+/)
      .map(Number);
    assert.equal(max, limit);
    assert(peak > 0 && peak < max && rss > 0);
    assert.equal(oom, 0);
    assert.equal(oomKill, 0);
    const state = JSON.parse(docker(["inspect", "-f", "{{json .State}}", container]));
    assert(state.Running && !state.OOMKilled);
    assert.equal(docker(["inspect", "-f", "{{.RestartCount}}", container]), "0");
    console.log("Memoria restringida", {
      limitBytes: max,
      cgroupPeakBytes: peak,
      backendRssPeakKiB: rss,
      oom,
      oomKill,
      restarts: 0,
      ...JSON.parse(result.stdout.trim()),
    });
  } finally {
    const removed = await executeCommand("docker", ["rm", "-f", container], directory, {
      timeoutMs: 15_000,
    });
    assert(
      removed.exitCode === 0 || /No such container/.test(removed.stderr),
      "Falló la limpieza del contenedor de memoria.",
    );
  }
}

export async function checkBackendSecurity(directory, env, signal) {
  await checkMemory(directory, env, signal);
  const backend = await startBackendServer(directory, "src/index.js", {
    ...env,
    LOGIN_IP_REQUEST_LIMIT: "300",
    LOGIN_IDENTIFIER_FAILURE_LIMIT: "120",
  });
  try {
    const client = authClient(backend.port);
    await checkCookieIsolation(client);
    console.log(
      "Backend con cookies: CSRF, exclusividad de transporte, logout y revocación comprobados.",
    );
    await compareTiming(client, signal);
  } finally {
    await stopProcess(backend.child);
  }
}
