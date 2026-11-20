import { describe, expect, it, vi } from "vitest";
import { createArgon2Limiter } from "../src/auth/argon2-limiter.js";
import {
  hashPassword,
  prepareDummyVerification,
  verifyPassword,
} from "../src/auth/password-crypto.js";

describe("capacidad de Argon2id", () => {
  it("comparte la plaza de un hash real con verify, dummy y su preparación", async () => {
    vi.stubEnv("ARGON2_MAX_CONCURRENT", "1");
    vi.stubEnv("ARGON2_MAX_QUEUE", "0");
    try {
      const checkDummy = await prepareDummyVerification();
      const phc = await hashPassword("prueba");
      const active = hashPassword("otra");
      // Enviar todo antes del primer await: la plaza sigue reservada, sin usar temporizadores.
      const attempts = [
        verifyPassword("prueba", phc),
        checkDummy("prueba"),
        prepareDummyVerification(),
        hashPassword("prueba"),
      ];
      await Promise.all(
        attempts.map((attempt) =>
          expect(attempt).rejects.toMatchObject({ code: "ARGON2_SATURATED" }),
        ),
      );
      await active;
      expect(await verifyPassword("prueba", phc)).toBe(true);
      expect(await checkDummy("prueba")).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("admite 2 activas y 8 en FIFO, rechaza la undécima y recupera la capacidad", async () => {
    const run = createArgon2Limiter({});
    const started: number[] = [];
    const release: Array<() => void> = [];
    const jobs = Array.from({ length: 10 }, (_, id) =>
      run(() => {
        started.push(id);
        return new Promise<void>((resolve) => release.push(resolve));
      }),
    );
    expect(started).toEqual([0, 1]);
    const overflow = vi.fn(async () => {});
    await expect(run(overflow)).rejects.toMatchObject({ code: "ARGON2_SATURATED" });
    for (let id = 0; id < 10; id++) {
      release[id]();
      await jobs[id];
      expect(started).toEqual(Array.from({ length: Math.min(id + 3, 10) }, (_, i) => i));
    }
    expect(overflow).not.toHaveBeenCalled();
    await expect(run(async () => 1)).resolves.toBe(1);
  });

  it("transfiere cada plaza también tras un rechazo y una excepción síncrona", async () => {
    const run = createArgon2Limiter({ ARGON2_MAX_CONCURRENT: "1", ARGON2_MAX_QUEUE: "2" });
    let fail!: (error: Error) => void;
    const first = run(
      () =>
        new Promise<void>((_, reject) => {
          fail = reject;
        }),
    );
    const second = run(() => {
      throw new Error("síncrona");
    });
    const last = run(async () => 3);
    fail(new Error("asíncrona"));
    await expect(first).rejects.toThrow("asíncrona");
    await expect(second).rejects.toThrow("síncrona");
    await expect(last).resolves.toBe(3);
  });

  it.each([
    ["ARGON2_MAX_CONCURRENT", "0"],
    ["ARGON2_MAX_CONCURRENT", ""],
    ["ARGON2_MAX_QUEUE", "-1"],
    ["ARGON2_MAX_QUEUE", "1.5"],
    ["ARGON2_MAX_CONCURRENT", " 2"],
    ["ARGON2_MAX_QUEUE", "1e2"],
    ["ARGON2_MAX_QUEUE", "9007199254740992"],
    ["ARGON2_MAX_QUEUE", 8],
  ])("rechaza configuración inválida en %s (%#)", (key, value) => {
    expect(() => createArgon2Limiter({ [key]: value })).toThrow(String(key));
  });
});
