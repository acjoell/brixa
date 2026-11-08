/**
 * Brixa — resolución de puntos de inserción con nombre.
 *
 * Los archivos base de plantilla contienen marcadores de la forma:
 *   // @@INSERT:<punto>@@
 *
 * Cada overlay aporta contribuciones (fragmentos de texto) a uno o más puntos.
 * Este módulo valida las contribuciones y resuelve los marcadores en el contenido.
 *
 * Reglas:
 *   - Punto sin contribuyente         → el marcador desaparece (sin línea en blanco).
 *   - Marcador sin resolver en salida → el generador falla.
 *   - Contribución a punto inexistente → error.
 *   - Contribución duplicada          → error que nombra al contribuyente.
 *   - Orden determinista              → alfabético por nombre de contribuyente.
 */

/**
 * Lista de puntos de inserción declarados en las plantillas de backend.
 */
export const KNOWN_INSERTION_POINTS: ReadonlySet<string> = new Set([
  "imports",
  "routes",
  "startup",
]);

/**
 * Comparación determinista por punto de código (independiente de locale/ICU).
 */
export function compareCodePoints(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Patrón que identifica un marcador de punto de inserción en una línea. */
const MARKER_RE = /^[ \t]*\/\/ @@INSERT:([A-Za-z][A-Za-z0-9_-]*)@@[ \t]*$/;

/** Extrae todos los nombres de punto presentes en el contenido. */
function findPoints(content: string): Set<string> {
  const points = new Set<string>();
  for (const line of content.split("\n")) {
    const m = MARKER_RE.exec(line);
    if (m) points.add(m[1] as string);
  }
  return points;
}

export interface Contribution {
  /** Nombre del overlay/contribuyente, usado para ordenar y para mensajes de error. */
  contributor: string;
  /** Líneas de código a insertar (sin salto de línea al final de cada una). */
  lines: string[];
}

/** Mapa de nombre-de-punto a lista de contribuciones. */
export type InsertionMap = Record<string, Contribution[]>;

/**
 * Valida que las contribuciones del mapa sean coherentes con el contenido:
 *   - No existen puntos referenciados que no estén en el contenido.
 *   - No existen contribuciones duplicadas (mismo punto + mismo contribuyente).
 *
 * @throws {Error} si se viola alguna regla.
 */
export function validateContributions(content: string, insertions: InsertionMap): void {
  const knownPoints = findPoints(content);

  for (const [point, contributions] of Object.entries(insertions)) {
    if (!knownPoints.has(point)) {
      throw new Error(
        `Punto de inserción desconocido: "${point}". Puntos disponibles: ${[...knownPoints].sort().join(", ") || "(ninguno)"}.`,
      );
    }

    const seen = new Set<string>();
    for (const c of contributions) {
      if (seen.has(c.contributor)) {
        throw new Error(
          `Contribución duplicada al punto "${point}" por el contribuyente "${c.contributor}".`,
        );
      }
      seen.add(c.contributor);
    }
  }
}

/**
 * Resuelve los marcadores de inserción en `content` usando las contribuciones de `insertions`.
 *
 * - Llama internamente a `validateContributions` antes de resolver.
 * - Punto sin contribuyentes → la línea del marcador se elimina.
 * - Punto con contribuyentes → el marcador se reemplaza con las líneas de cada contribuyente,
 *   ordenadas por punto de código del nombre de contribuyente.
 * - Tras la resolución, si queda algún marcador `@@INSERT:` → error.
 *
 * @throws {Error} si se viola alguna regla de validación o si queda un marcador sin resolver.
 */
export function resolveInsertionPoints(content: string, insertions: InsertionMap): string {
  validateContributions(content, insertions);

  const outputLines: string[] = [];

  for (const line of content.split("\n")) {
    const m = MARKER_RE.exec(line);
    if (!m) {
      outputLines.push(line);
      continue;
    }

    const point = m[1] as string;
    const contributions = insertions[point] ?? [];

    if (contributions.length === 0) {
      // Punto sin contribuyente: la línea desaparece sin dejar rastro.
      continue;
    }

    // La indentación del marcador se aplica como prefijo a cada línea insertada.
    const indent = /^([ \t]*)/.exec(line)?.[1] ?? "";

    // Orden determinista: por punto de código del contribuyente.
    const sorted = [...contributions].sort((a, b) =>
      compareCodePoints(a.contributor, b.contributor),
    );
    for (const c of sorted) {
      for (const insertedLine of c.lines) {
        // Las líneas vacías no reciben indentación (evitan trailing whitespace).
        outputLines.push(insertedLine.length > 0 ? indent + insertedLine : insertedLine);
      }
    }
  }

  const result = outputLines.join("\n");

  // Verificar que no quede ningún marcador sin resolver.
  if (/@@INSERT:/.test(result)) {
    const remaining = result
      .split("\n")
      .filter((l) => /@@INSERT:/.test(l))
      .join(", ");
    throw new Error(`Marcadores de inserción sin resolver en la salida: ${remaining}`);
  }

  return result;
}

/**
 * Elimina solo los puntos declarados no resueltos (imports, routes, startup)
 * y falla si queda cualquier otro marcador @@INSERT:...@@ (por ejemplo, con typo).
 */
export function cleanupInsertionPoints(
  content: string,
  allowedPoints: ReadonlySet<string> = KNOWN_INSERTION_POINTS,
): string {
  const outputLines: string[] = [];

  for (const line of content.split("\n")) {
    const m = MARKER_RE.exec(line);
    if (!m) {
      outputLines.push(line);
      continue;
    }

    const point = m[1] as string;
    if (allowedPoints.has(point)) {
      // Punto declarado sin contribuyente: se elimina.
      continue;
    }

    // Marcador no declarado / typo: no se descarta para que falle en la comprobación final.
    outputLines.push(line);
  }

  const result = outputLines.join("\n");

  if (/@@INSERT:/.test(result)) {
    const unhandled = result
      .split("\n")
      .filter((l) => /@@INSERT:/.test(l))
      .map((l) => l.trim())
      .join(", ");
    throw new Error(
      `Marcador de inserción no reconocido o sin resolver en la salida: ${unhandled}. Puntos declarados permitidos: ${[...allowedPoints].sort().join(", ")}.`,
    );
  }

  return result;
}
