/**
 * Foundry — punto de entrada del CLI.
 *
 * Devuelve el código de salida en lugar de llamar a process.exit directamente,
 * para que los tests puedan comprobar el resultado sin efectos secundarios.
 */
import { runPrompts } from "./prompts/questions.js";
import { validateOptionsWithDir, formatValidationError } from "./validation/options.js";

export async function main(): Promise<number> {
  const raw = await runPrompts();

  if (raw === null) {
    // Cancelación limpia: el usuario salió con Ctrl+C.
    console.log("\nOperación cancelada.");
    return 0;
  }

  const result = await validateOptionsWithDir(raw);

  if (!result.ok) {
    console.error(`Error: ${formatValidationError(result.error)}`);
    return 1;
  }

  const { modality, language, outputDir } = result.value;
  // Resumen final con ruta absoluta resuelta.
  console.log(`\nOpciones seleccionadas:`);
  console.log(`  Modalidad : ${modality}`);
  console.log(`  Lenguaje  : ${language}`);
  console.log(`  Directorio: ${outputDir}`);
  console.log("\n(Generación pendiente — T-006)");
  return 0;
}
