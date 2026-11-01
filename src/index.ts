/**
 * Brixa — punto de entrada del CLI.
 *
 * Devuelve el código de salida en lugar de llamar a process.exit directamente,
 * para que los tests puedan comprobar el resultado sin efectos secundarios.
 */
import { runPrompts } from "./prompts/questions.js";
import { validateOptionsWithDir, formatValidationError } from "./validation/options.js";
import { generate, formatGenerateError, nextStepsMessage } from "./generator/generate.js";

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

  const { modality, language, database, docker, apiDocs, i18n, outputDir } = result.value;

  const genResult = await generate({
    modality,
    language,
    database,
    docker,
    apiDocs,
    i18n,
    outputDir,
  });

  if (!genResult.ok) {
    console.error(`Error: ${formatGenerateError(genResult.error)}`);
    return 1;
  }

  console.log(nextStepsMessage(outputDir, modality, database, docker, language, apiDocs, i18n));
  return 0;
}
