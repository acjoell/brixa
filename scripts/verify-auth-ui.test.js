import { execFileSync, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { expect, test, vi } from "vitest";
import { generate } from "../src/generator/generate.ts";
import { reportComposeStartupFailure, startDockerUi } from "./fixtures/auth-https/ui-deployment.js";
import { executeCommand } from "./mutation-engine.js";
import { bootstrapSource, navigatePage, trustedForwardingHeaders } from "./verify-auth-https.js";
import { runStep } from "./verify-auth.js";
import { startBackendServer, stopProcess } from "./verify-generated.js";

vi.mock("node:child_process", async (original) => ({
  ...(await original()),
  spawn: vi.fn(),
  execFileSync: vi.fn(),
}));

vi.mock("./mutation-engine.js", () => ({ executeCommand: vi.fn() }));

test("el diagnóstico CDP emite el paso y solo un código de red válido", async () => {
  const url = "https://brixa.test/activate#token=secreto-fixture";
  const step = "apertura de activación";
  const send = vi.fn().mockResolvedValueOnce({ errorText: "net::ERR_CERT_AUTHORITY_INVALID" });
  send.mockResolvedValueOnce({ errorText: "net::ERR_FAILED " + url });
  send.mockResolvedValueOnce({});

  await expect(navigatePage(send, url, step)).rejects.toThrow(
    /^Chromium no pudo navegar en apertura de activación \(net::ERR_CERT_AUTHORITY_INVALID\)\.$/,
  );
  await expect(navigatePage(send, url, step)).rejects.toThrow(
    /^Chromium no pudo navegar en apertura de activación\.$/,
  );
  await expect(navigatePage(send, url, step)).resolves.toBeUndefined();
});

test("reemplaza cabeceras no confiables y conserva el contrato mismo origen", () => {
  expect(
    trustedForwardingHeaders({
      headers: {
        forwarded: "ignored",
        "x-forwarded-for": "ignored",
        "x-forwarded-proto": "ignored",
        "x-real-ip": "ignored",
        origin: "https://brixa.test",
        "x-requested-with": "XMLHttpRequest",
      },
      socket: { remoteAddress: "127.0.0.1" },
    }),
  ).toEqual({
    "x-forwarded-for": "127.0.0.1",
    "x-forwarded-proto": "https",
    origin: "https://brixa.test",
    "x-requested-with": "XMLHttpRequest",
  });
  expect(bootstrapSource("dist", true)).toContain('from "./dist/db/bootstrap.js"');
  expect(bootstrapSource("src")).toContain('from "./src/db/local-admin.js"');
});

test("diagnostica un arranque sensible antes de propagar su error, sin emitir datos crudos", async () => {
  const compose = ["compose", "--project-name", "brixa-test"];
  const env = { DATABASE_URL: "postgresql://app_exec:clave-fixture@postgres/app" };
  const spy = vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(executeCommand)
    .mockResolvedValueOnce({
      exitCode: 1,
      durationMs: 1,
      stdout: "token-fixture",
      stderr:
        "user specified IP address is supported only when connecting to networks with user configured subnets",
    })
    .mockResolvedValueOnce({
      stdout: "postgres running healthy 0\nbackend created  0\nfrontend clave-fixture",
    })
    .mockResolvedValueOnce({ stdout: "", stderr: "password=clave-fixture" });
  try {
    await expect(
      runStep(
        "Arranque Nginx y Express",
        "docker",
        [...compose, "up", "-d", "--wait"],
        "/fixture",
        {
          env,
          sensitive: true,
          onFailure: (result) => reportComposeStartupFailure(result, compose, "/fixture", env),
        },
      ),
    ).rejects.toThrow("Arranque Nginx y Express: 1");
    expect(
      vi
        .mocked(executeCommand)
        .mock.calls.slice(1)
        .map(([, args, , options]) => [args.slice(3, 4)[0], options.timeoutMs]),
    ).toEqual([
      ["ps", 5_000],
      ["logs", 5_000],
    ]);
    const output = spy.mock.calls.flat().join("\n");
    expect(output).toContain("Docker exige una subred explícita");
    expect(output).toContain("postgres running healthy 0\nbackend created  0");
    expect(output).not.toMatch(/clave-fixture|token-fixture/);
  } finally {
    spy.mockRestore();
  }
});

test.skipIf(process.platform !== "linux")(
  "A usa el Compose TLS generado y conserva los archivos al reintentar una subred",
  async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), "brixa-compose-test-"));
    const project = path.join(workspace, "project");
    await using cleanup = new globalThis.AsyncDisposableStack();
    cleanup.defer(() => rm(workspace, { recursive: true, force: true }));
    expect(
      await generate({
        outputDir: project,
        modality: "fullstack",
        language: "ts",
        database: "postgres",
        docker: true,
        auth: true,
        apiDocs: true,
      }),
    ).toEqual({ ok: true });
    const files = [
      "compose.yaml",
      "compose.tls.yaml",
      "frontend/nginx.conf",
      "frontend/nginx.tls.conf",
    ];
    const contents = () => Promise.all(files.map((file) => readFile(path.join(project, file))));
    const before = await contents();
    await writeFile(path.join(workspace, "tls.key"), "key-fixture", { mode: 0o600 });
    const execute = vi.mocked(executeCommand);
    const command = vi.mocked(execFileSync);
    const gid = vi.spyOn(process, "getgid").mockReturnValue(1000);
    execute
      .mockReset()
      .mockResolvedValueOnce({
        exitCode: 1,
        durationMs: 1,
        stderr: "Pool overlaps with other one on this address space",
      })
      .mockResolvedValue({ exitCode: 0, durationMs: 1 });
    command
      .mockReset()
      .mockReturnValueOnce("28.0.0")
      .mockReturnValueOnce("2.24.4")
      .mockReturnValueOnce("postgres-container")
      .mockReturnValueOnce("170004")
      .mockReturnValueOnce("")
      .mockReturnValueOnce("127.0.0.1:4443");
    try {
      const origin = await startDockerUi({
        project,
        workspace,
        cleanup,
        admin: { email: "admin@example.test", password: "fixture" },
      });
      expect(await contents()).toEqual(before);
      const calls = execute.mock.calls;
      const compose = ["-f", "compose.yaml", "-f", "compose.tls.yaml"];
      expect(calls.every(([, args]) => args.slice(3, 7).join(" ") === compose.join(" "))).toBe(
        true,
      );
      expect(calls.slice(0, 2).map(([, args]) => args.slice(7))).toEqual([
        ["up", "-d", "--wait", "postgres"],
        ["up", "-d", "--wait", "postgres"],
      ]);
      const env = calls[1][3].env;
      const block = env.TLS_NGINX_IP.slice(0, -2);
      expect(env.TLS_NGINX_IP).toMatch(/^10\.\d+\.\d+\.2$/);
      expect(env.TLS_SUBNET).toBe(block + ".0/28");
      expect(env.TLS_DYNAMIC_RANGE).toBe(block + ".8/29");
      expect(env).toMatchObject({ TLS_PORT: "0", AUTH_PUBLIC_ORIGIN: origin });
      expect(env.AUTH_TRUSTED_PROXIES).toBeUndefined();
      expect(env.ACTIVATION_PAGE_URL).toBeUndefined();
      const preparation = command.mock.calls.find(([, args]) => args[0] === "run");
      expect(preparation[1]).toEqual(
        expect.arrayContaining([
          `${calls[0][1][2]}-frontend`,
          "101:1000",
          "--cap-drop",
          "--read-only",
          "umask 0377; cat > /key/tls.key",
        ]),
      );
      expect(preparation[2].input.toString()).toBe("key-fixture");
      await cleanup.disposeAsync();
      expect(execute.mock.calls.at(-1)[1].slice(3, 8)).toEqual([...compose, "down"]);
    } finally {
      await cleanup.disposeAsync();
      gid.mockRestore();
      execute.mockReset();
      command.mockReset();
    }
  },
);

test.skipIf(process.platform === "win32")(
  "espera la salida de Chromium tras señales concurrentes",
  async () => {
    const child = Object.assign(new EventEmitter(), {
      pid: 123,
      exitCode: null,
      signalCode: null,
      killed: false,
      kill: vi.fn(() => {
        child.killed = true;
      }),
    });
    const interrupted = stopProcess(child);
    const cleanup = stopProcess(child);
    expect(cleanup).toBe(interrupted);
    const finished = vi.fn();
    void cleanup.then(finished);
    await Promise.resolve();
    expect(finished).not.toHaveBeenCalled();
    child.signalCode = "SIGTERM";
    child.emit("exit", null, "SIGTERM");
    await cleanup;
    expect(finished).toHaveBeenCalledOnce();
    expect(child.kill).toHaveBeenCalledExactlyOnceWith("SIGTERM");
  },
);

test("conserva el diagnóstico del backend B después de sanear una línea fragmentada", async () => {
  const child = Object.assign(new EventEmitter(), {
    stdout: new PassThrough(),
    stderr: new PassThrough(),
  });
  vi.mocked(spawn).mockReturnValueOnce(child);
  const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
  try {
    const ready = startBackendServer(
      "/fixture",
      "backend.mjs",
      {},
      {
        sanitizeOutput: (text) => text.replaceAll("secreto-partido", "***"),
      },
    );
    child.stderr.write("Fallo de configuración: secreto-");
    child.stderr.end("partido\n");
    child.stdout.end("http://localhost:1234\n");
    const backend = await ready;
    const output = stderr.mock.calls.flat().join("");
    expect(output).toContain("Fallo de configuración: ***");
    expect(output).not.toContain("secreto-");
    expect(backend.stderrLines).toContain("Fallo de configuración: ***");
  } finally {
    stderr.mockRestore();
  }
});
