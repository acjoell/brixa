import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { BootstrapError } from "./bootstrap.js";
import { isPasswordWithinLimits } from "./password-limits.js";

const messages = {
  INVALID_CREDENTIALS: "Introduce un email válido y una contraseña dentro de los límites.",
  ALREADY_INITIALIZED: "El administrador inicial ya está configurado.",
  EMAIL_IN_USE: "El email ya pertenece a una cuenta existente.",
  BOOTSTRAP_FAILED:
    "No se pudo completar el bootstrap. Revisa la configuración, la conexión y el estado de la base de datos.",
};

export async function readConsoleCredentials(includeEmail: boolean) {
  const { stdin, stdout } = process;
  const rawBefore = stdin.isRaw;
  const answers: string[] = [];
  const echo = new Writable({
    write(chunk, _encoding, done) {
      // Oculta también el redibujado de readline al editar o pegar una contraseña.
      if (includeEmail && answers.length === 0) stdout.write(chunk);
      done();
    },
  });
  const terminal = createInterface({ input: stdin, output: echo, terminal: true, historySize: 0 });
  try {
    return await new Promise<string[] | null>((resolve, reject) => {
      const cancel = () => resolve(null);
      terminal.on("SIGINT", cancel);
      terminal.on("error", () => reject(new Error("No se pudo leer la terminal.")));
      // readline puede emitir una línea parcial antes de cerrar al recibir EOF.
      stdin.prependOnceListener("end", cancel);
      process.once("SIGINT", cancel);
      process.once("SIGTERM", cancel);
      terminal.once("close", () => {
        stdin.off("end", cancel);
        process.off("SIGINT", cancel);
        process.off("SIGTERM", cancel);
        cancel();
      });
      terminal.on("line", (answer) => {
        const total = includeEmail ? 3 : 2;
        if (answers.length === total) return;
        answers.push(answer);
        if (answers.length === total) resolve(answers);
        else if (includeEmail && answers.length === 1) stdout.write("Contraseña: ");
        else stdout.write("\nConfirma la contraseña: ");
      });
      stdout.write(includeEmail ? "Email: " : "Contraseña: ");
    });
  } finally {
    terminal.close();
    if (stdin.isRaw !== rawBefore) stdin.setRawMode(rawBefore);
    echo.destroy();
    stdout.write("\n");
  }
}

export async function runBootstrapConsole(
  bootstrap: (credentials: { email: string; password: string }) => Promise<unknown>,
) {
  if (process.argv.length !== 2 || !process.stdin.isTTY || !process.stdout.isTTY) {
    process.stderr.write("Ejecuta auth:bootstrap en una terminal interactiva y sin argumentos.\n");
    process.exitCode = 1;
    return;
  }
  try {
    const answers = await readConsoleCredentials(true);
    if (!answers) {
      process.stderr.write("Bootstrap cancelado.\n");
      process.exitCode = 130;
      return;
    }
    const [email, password, confirmation] = answers;
    if (password !== confirmation) {
      process.stderr.write("Las contraseñas no coinciden.\n");
      process.exitCode = 1;
      return;
    }
    if (password === "" || !isPasswordWithinLimits(password)) {
      throw new BootstrapError("INVALID_CREDENTIALS");
    }
    await bootstrap({ email, password });
    process.stdout.write("Administrador inicial creado.\n");
  } catch (error) {
    const message =
      error instanceof BootstrapError ? messages[error.code] : messages.BOOTSTRAP_FAILED;
    process.stderr.write(message + "\n");
    process.exitCode = 1;
  }
}
