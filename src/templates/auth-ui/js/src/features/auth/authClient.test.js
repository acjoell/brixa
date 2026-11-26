import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { activate, getSession, login, logout, validateActivation } from "./authClient.js";

const userId = "fe042593-89a0-4373-9d31-f65c7f64eb62";
const credentials = { email: "test@example.test", password: "login test fixture" };
const activation = { token: "activation test fixture", password: "activation password fixture" };
const fetch = vi.fn();

beforeEach(() => {
  fetch.mockReset();
  vi.stubGlobal("fetch", fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("consulta sesión mediante cookies y valida el 200 JSON", async () => {
  fetch.mockResolvedValue(globalThis.Response.json({ userId }));
  const { signal } = new globalThis.AbortController();

  await expect(getSession(signal)).resolves.toEqual({ kind: "ok", data: { userId } });
  expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/auth/session", {
    method: "GET",
    mode: "same-origin",
    referrerPolicy: "same-origin",
    credentials: "same-origin",
    redirect: "error",
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });
});

it.each([
  { path: "login", body: credentials, send: (signal) => login(credentials, signal) },
  { path: "logout", body: undefined, send: logout },
  {
    path: "activate",
    body: activation,
    send: (signal) => activate(activation, signal),
  },
])(
  "envía el POST de $path con CSRF y acepta un 204 sin leer el cuerpo",
  async ({ path, body, send }) => {
    const response = new globalThis.Response(null, { status: 204 });
    const readJson = vi.spyOn(response, "json");
    const readText = vi.spyOn(response, "text");
    fetch.mockResolvedValue(response);
    const { signal } = new globalThis.AbortController();

    await expect(send(signal)).resolves.toEqual({ kind: "ok", data: undefined });
    expect(fetch).toHaveBeenCalledExactlyOnceWith(`/api/auth/${path}`, {
      method: "POST",
      mode: "same-origin",
      referrerPolicy: "same-origin",
      credentials: "same-origin",
      redirect: "error",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "X-Requested-With": "XMLHttpRequest",
        ...(body && { "Content-Type": "application/json" }),
      },
      signal,
      ...(body && { body: JSON.stringify(body) }),
    });
    expect(readJson).not.toHaveBeenCalled();
    expect(readText).not.toHaveBeenCalled();
  },
);

const policy = { minLength: 12, maxLength: 50, maxBytes: 512 };

it("envía únicamente el token y lee la política efectiva del 200 JSON", async () => {
  const { signal } = new globalThis.AbortController();
  fetch.mockResolvedValue(globalThis.Response.json({ passwordPolicy: policy }));
  await expect(validateActivation(activation.token, signal)).resolves.toEqual({
    kind: "ok",
    data: policy,
  });
  expect(fetch).toHaveBeenCalledExactlyOnceWith("/api/auth/activate/validate", {
    method: "POST",
    mode: "same-origin",
    referrerPolicy: "same-origin",
    credentials: "same-origin",
    redirect: "error",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    signal,
    body: JSON.stringify({ token: activation.token }),
  });
});

it.each([
  { ...policy, minLength: 7 },
  { ...policy, maxLength: 129 },
  { ...policy, minLength: 60 },
  { ...policy, minLength: 12.5 },
  { ...policy, maxBytes: 513 },
  { ...policy, email: "fixture@example.test" },
])("rechaza una política fuera del contrato HTTP", async (passwordPolicy) => {
  fetch.mockResolvedValue(globalThis.Response.json({ passwordPolicy }));
  await expect(validateActivation(activation.token)).resolves.toEqual({
    kind: "unexpected_response",
    status: 200,
  });
});

it("distingue el rechazo de política de un enlace inválido sin propagar mensajes", async () => {
  fetch.mockResolvedValueOnce(
    globalThis.Response.json({ error: "ignored", code: "PASSWORD_POLICY" }, { status: 400 }),
  );
  fetch.mockResolvedValueOnce(globalThis.Response.json({ error: "Bad Request" }, { status: 400 }));
  await expect(activate(activation)).resolves.toEqual({
    kind: "http",
    status: 400,
    retryAfter: null,
    code: "PASSWORD_POLICY",
  });
  await expect(activate(activation)).resolves.toEqual({
    kind: "http",
    status: 400,
    retryAfter: null,
  });
});

it.each([
  ["tipo de contenido", () => new globalThis.Response(JSON.stringify({ userId }))],
  [
    "JSON inválido",
    () => new globalThis.Response("{", { headers: { "Content-Type": "application/json" } }),
  ],

  ["objeto nulo", () => globalThis.Response.json(null)],
  ["ausencia de userId", () => globalThis.Response.json({})],
  ["identificador inválido", () => globalThis.Response.json({ userId: "invalid" })],
  ["campos adicionales", () => globalThis.Response.json({ userId, token: "response fixture" })],
])("rechaza un 200 de sesión con %s", async (_description, response) => {
  fetch.mockResolvedValue(response());
  await expect(getSession()).resolves.toEqual({ kind: "unexpected_response", status: 200 });
});

it("distingue códigos satisfactorios ajenos al contrato de cada operación", async () => {
  fetch.mockResolvedValueOnce(new globalThis.Response(null, { status: 204 }));
  fetch.mockResolvedValueOnce(globalThis.Response.json({ token: "response fixture" }));
  await expect(getSession()).resolves.toEqual({ kind: "unexpected_response", status: 204 });
  await expect(login(credentials)).resolves.toEqual({ kind: "unexpected_response", status: 200 });
});

it.each([
  ["sesión", getSession, "no_session"],
  ["login", () => login(credentials), "invalid_credentials"],
  ["logout", logout, "no_session"],
  ["activación", () => activate(activation), undefined],
])("interpreta el 401 en el contexto de %s", async (_operation, send, unauthorized) => {
  fetch.mockResolvedValue(globalThis.Response.json({ error: "Unauthorized" }, { status: 401 }));
  await expect(send()).resolves.toEqual({
    kind: "http",
    status: 401,
    retryAfter: null,
    ...(unauthorized && { unauthorized }),
  });
});

it.each([
  [400, null],
  [403, null],
  [429, "12"],
  [503, "5"],
  [502, null],
])(
  "conserva el estado %i y Retry-After sin leer el cuerpo de error",
  async (status, retryAfter) => {
    const response = new globalThis.Response("untrusted server message", {
      status,
      headers: retryAfter === null ? {} : { "Retry-After": retryAfter },
    });
    const readJson = vi.spyOn(response, "json");
    const readText = vi.spyOn(response, "text");
    fetch.mockResolvedValue(response);

    await expect(activate(activation)).resolves.toEqual({ kind: "http", status, retryAfter });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(readJson).not.toHaveBeenCalled();
    expect(readText).not.toHaveBeenCalled();
  },
);

it("distingue un fallo de red al enviar la petición o descargar el cuerpo", async () => {
  fetch.mockRejectedValueOnce(new TypeError("fixture transport error"));
  const stream = new globalThis.ReadableStream({
    start(controller) {
      controller.error(new TypeError("fixture response interrupted"));
    },
  });
  fetch.mockResolvedValueOnce(
    new globalThis.Response(stream, { headers: { "Content-Type": "application/json" } }),
  );

  await expect(login(credentials)).resolves.toEqual({ kind: "communication" });
  await expect(getSession()).resolves.toEqual({ kind: "communication" });
  expect(fetch).toHaveBeenCalledTimes(2);
});

it("cancela de forma nativa una petición en curso y evita enviar una ya cancelada", async () => {
  const controller = new globalThis.AbortController();
  fetch.mockImplementationOnce(
    (_path, options) =>
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(options.signal?.reason), {
          once: true,
        });
      }),
  );

  const inFlight = getSession(controller.signal);
  controller.abort("fixture cancel reason");
  await expect(inFlight).resolves.toEqual({ kind: "aborted" });
  await expect(activate(activation, controller.signal)).resolves.toEqual({ kind: "aborted" });
  expect(fetch).toHaveBeenCalledTimes(1);
});

it("no guarda ni registra contraseñas, tokens o mensajes del servidor", async () => {
  const setItem = vi.fn();
  vi.stubGlobal("localStorage", { setItem });
  vi.stubGlobal("sessionStorage", { setItem });
  const logs = ["debug", "info", "log", "warn", "error"].map((method) =>
    vi.spyOn(globalThis.console, method).mockImplementation(() => {}),
  );
  fetch.mockResolvedValueOnce(new globalThis.Response(null, { status: 204 }));
  fetch.mockResolvedValueOnce(
    globalThis.Response.json(
      { error: activation.token, password: activation.password },
      { status: 400 },
    ),
  );

  await expect(login(credentials)).resolves.toEqual({ kind: "ok", data: undefined });
  await expect(activate(activation)).resolves.toEqual({
    kind: "http",
    status: 400,
    retryAfter: null,
  });
  expect(setItem).not.toHaveBeenCalled();
  for (const log of logs) expect(log).not.toHaveBeenCalled();
});
