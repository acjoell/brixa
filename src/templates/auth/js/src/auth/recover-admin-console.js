import { randomUUID } from "node:crypto";
import { readConsoleCredentials } from "./bootstrap-console.js";
import { isPasswordWithinLimits } from "./password-limits.js";

export async function runAdminRecoveryConsole(recover) {
  if (process.argv.length !== 2 || !process.stdin.isTTY || !process.stdout.isTTY) {
    process.stderr.write(
      "Ejecuta auth:recover-admin en una terminal interactiva y sin argumentos.\n",
    );
    process.exitCode = 1;
    return;
  }

  try {
    const answers = await readConsoleCredentials(false);
    if (!answers) {
      process.stderr.write("Recuperación cancelada.\n");
      process.exitCode = 130;
      return;
    }
    const [password, confirmation] = answers;
    if (password !== confirmation) {
      process.stderr.write("Las contraseñas no coinciden.\n");
      process.exitCode = 1;
      return;
    }
    if (password === "" || !isPasswordWithinLimits(password)) {
      process.stderr.write("Introduce una contraseña dentro de los límites.\n");
      process.exitCode = 1;
      return;
    }
    if (await recover(password, randomUUID())) {
      process.stdout.write("Contraseña del administrador inicial recuperada.\n");
      return;
    }
  } catch {
    // La salida del CLI nunca incluye errores del driver ni secretos de conexión.
  }
  process.stderr.write("No se pudo recuperar al administrador inicial.\n");
  process.exitCode = 1;
}
