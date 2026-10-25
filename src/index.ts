/**
 * Foundry — punto de entrada del CLI.
 *
 * Devuelve el código de salida en lugar de llamar a process.exit directamente,
 * para que los tests puedan comprobar el resultado sin efectos secundarios.
 */
import { runPrompts } from "./prompts/questions.js";
import { validateOptions, formatValidationError } from "./validation/options.js";

export async function main(): Promise<number> {
  const raw = await runPrompts();

  if (raw === null) {
    // Cancelación limpia: el usuario salió con Ctrl+C.
    console.log("\nOperación cancelada.");
    return 0;
  }

  const result = validateOptions(raw);

  if (!result.ok) {
    console.error(`Error: ${formatValidationError(result.error)}`);
    return 1;
  }

  const { modality, language } = result.value;
  // Confirmación temporal hasta que T-005 implemente la generación real.
  console.log(`\nOpciones seleccionadas: modalidad=${modality}, lenguaje=${language}`);
  console.log("(Generación pendiente — T-005)");
  return 0;
}
