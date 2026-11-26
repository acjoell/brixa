import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";

// Mock de @inquirer/prompts antes de importar el módulo bajo prueba.
vi.mock("@inquirer/prompts", () => ({
  select: vi.fn(),
  input: vi.fn(),
  confirm: vi.fn(),
}));

// Mock de ../types.js no necesario; importamos el módulo real.
const { select, input, confirm } = await import("@inquirer/prompts");
const selectMock = select as Mock;
const inputMock = input as Mock;
const confirmMock = confirm as Mock;

// Importamos después del mock para que el módulo recoja el stub.
const { runPrompts } = await import("./questions.js");

describe("runPrompts", () => {
  beforeEach(() => {
    selectMock.mockReset();
    inputMock.mockReset();
    confirmMock.mockReset();
  });

  it("devuelve las opciones cuando el usuario completa los prompts en frontend sin preguntar BD", async () => {
    selectMock.mockResolvedValueOnce("frontend").mockResolvedValueOnce("ts");
    confirmMock.mockResolvedValueOnce(true);
    inputMock.mockResolvedValueOnce("./my-app");

    const result = await runPrompts();

    expect(selectMock).toHaveBeenCalledTimes(2);
    expect(confirmMock).toHaveBeenCalledTimes(1);
    expect(confirmMock).toHaveBeenCalledWith(
      expect.objectContaining({ message: "¿Internacionalización (i18n)?" }),
    );
    expect(result).toEqual({
      modality: "frontend",
      language: "ts",
      database: "none",
      docker: false,
      apiDocs: false,
      i18n: true,
      auth: false,
      authTransport: undefined,
      authAppMode: undefined,
      outputDir: "./my-app",
    });
  });

  it("devuelve null cuando el usuario cancela con Ctrl+C (ExitPromptError)", async () => {
    const exitError = Object.assign(new Error("cancelado"), { name: "ExitPromptError" });
    selectMock.mockRejectedValueOnce(exitError);

    const result = await runPrompts();

    expect(result).toBeNull();
  });

  it("propaga errores inesperados", async () => {
    const unexpectedError = new Error("fallo inesperado");
    selectMock.mockRejectedValueOnce(unexpectedError);

    await expect(runPrompts()).rejects.toThrow("fallo inesperado");
  });

  it("solicita base de datos en backend y fullstack, devolviendo la opción seleccionada", async () => {
    selectMock
      .mockResolvedValueOnce("backend")
      .mockResolvedValueOnce("js")
      .mockResolvedValueOnce("postgres");
    confirmMock
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    inputMock.mockResolvedValueOnce("/home/user/projects/api");

    const result = await runPrompts();

    expect(selectMock).toHaveBeenCalledTimes(3);
    expect(confirmMock).toHaveBeenCalledTimes(3);
    expect(confirmMock).toHaveBeenLastCalledWith({
      message: "¿Autenticación (Auth)?",
      default: false,
    });
    expect(result).toEqual({
      modality: "backend",
      language: "js",
      database: "postgres",
      docker: false,
      apiDocs: true,
      i18n: false,
      auth: false,
      authTransport: undefined,
      authAppMode: undefined,
      outputDir: "/home/user/projects/api",
    });
  });

  it.each(["backend", "fullstack"] as const)("omite Auth en %s sin BD", async (modality) => {
    selectMock
      .mockResolvedValueOnce(modality)
      .mockResolvedValueOnce("ts")
      .mockResolvedValueOnce("none");
    confirmMock.mockResolvedValue(false);
    inputMock.mockResolvedValue("./my-app");

    await expect(runPrompts()).resolves.toMatchObject({ auth: false, authTransport: undefined });
    expect(selectMock).toHaveBeenCalledTimes(3);
    expect(confirmMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: "¿Autenticación (Auth)?" }),
    );
  });

  it.each(["cookie", "bearer"] as const)(
    "permite seleccionar %s para Auth en backend",
    async (mode) => {
      selectMock
        .mockResolvedValueOnce("backend")
        .mockResolvedValueOnce("ts")
        .mockResolvedValueOnce("sqlite")
        .mockResolvedValueOnce(mode);
      confirmMock
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      inputMock.mockResolvedValue("./my-app");

      await expect(runPrompts()).resolves.toMatchObject({ auth: true, authTransport: mode });
      expect(selectMock).toHaveBeenCalledTimes(4);
      expect(selectMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          default: "cookie",
          choices: [
            expect.objectContaining({ value: "cookie" }),
            expect.objectContaining({ value: "bearer" }),
          ],
        }),
      );
    },
  );

  it("omite la modalidad de aplicación en fullstack sin Auth", async () => {
    selectMock
      .mockResolvedValueOnce("fullstack")
      .mockResolvedValueOnce("ts")
      .mockResolvedValueOnce("postgres");
    confirmMock.mockResolvedValue(false);
    inputMock.mockResolvedValue("./my-app");

    await expect(runPrompts()).resolves.toMatchObject({ auth: false, authAppMode: undefined });
    expect(selectMock).toHaveBeenCalledTimes(3);
  });

  it.each(["private", "public"] as const)(
    "permite elegir %s en fullstack con Auth",
    async (mode) => {
      selectMock
        .mockResolvedValueOnce("fullstack")
        .mockResolvedValueOnce("ts")
        .mockResolvedValueOnce("postgres")
        .mockResolvedValueOnce(mode);
      confirmMock
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);
      inputMock.mockResolvedValue("./my-app");

      await expect(runPrompts()).resolves.toMatchObject({
        auth: true,
        authTransport: undefined,
        authAppMode: mode,
      });
      expect(selectMock).toHaveBeenCalledTimes(4);
      expect(selectMock).toHaveBeenLastCalledWith({
        message: "¿Cómo se accederá a la aplicación?",
        default: "private",
        choices: [
          { name: "Aplicación privada", value: "private" },
          { name: "Landing pública + aplicación protegida", value: "public" },
        ],
      });
    },
  );

  it("cancela la generación desde la selección del transporte", async () => {
    selectMock
      .mockResolvedValueOnce("backend")
      .mockResolvedValueOnce("ts")
      .mockResolvedValueOnce("sqlite")
      .mockRejectedValueOnce(Object.assign(new Error("cancelado"), { name: "ExitPromptError" }));
    confirmMock
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);

    await expect(runPrompts()).resolves.toBeNull();
    expect(inputMock).not.toHaveBeenCalled();
  });

  it("cancela limpio si Ctrl+C ocurre en el tercer prompt (directorio)", async () => {
    const exitError = Object.assign(new Error("cancelado"), { name: "ExitPromptError" });
    selectMock.mockResolvedValueOnce("frontend").mockResolvedValueOnce("ts");
    inputMock.mockRejectedValueOnce(exitError);

    const result = await runPrompts();

    expect(result).toBeNull();
  });
});
