import { readFileSync } from "node:fs";

const RESET = "\u001b[0m";
const INDIGO = "\u001b[38;5;99m";
const GRAY = "\u001b[38;5;246m";

const LOGO = ["█▄▄ █▀█ █ ▀▄▀ ▄▀█", "█▄█ █▀▄ █ ▄▀▄ █▀█"] as const;

const TAGLINE = "Genera la base de tu próximo proyecto web";

interface OutputStream {
  isTTY?: boolean;
}

/** El banner solo se muestra en una terminal interactiva (no en tuberías ni tests). */
export function shouldShowBanner(stream: OutputStream, env: NodeJS.ProcessEnv): boolean {
  return stream.isTTY === true && env["TERM"] !== "dumb";
}

/** NO_COLOR (https://no-color.org) desactiva el color pero no el banner. */
export function shouldUseColor(stream: OutputStream, env: NodeJS.ProcessEnv): boolean {
  const noColor = env["NO_COLOR"];
  return shouldShowBanner(stream, env) && (noColor === undefined || noColor === "");
}

const BOX_WIDTH = 47;
const MIN_COLUMNS = BOX_WIDTH + 6;

type Segment = [text: string, color: string];

export function renderBanner(version: string, useColor: boolean, columns = 80): string {
  const paint = (code: string, text: string): string =>
    useColor && code !== "" ? `${code}${text}${RESET}` : text;
  const versionText = version === "" ? "" : `   v${version}`;
  const logoWidth = LOGO[0].length;
  const blockWidth = logoWidth + versionText.length;

  if (columns < MIN_COLUMNS) {
    // Terminal demasiado estrecha para el recuadro: versión sin marco.
    return [
      "",
      `  ${paint(INDIGO, LOGO[0])}`,
      `  ${paint(INDIGO, LOGO[1])}${paint(GRAY, versionText)}`,
      "",
      `  ${paint(GRAY, TAGLINE)}`,
      "",
    ].join("\n");
  }

  const border = (text: string): string => paint(GRAY, text);
  const row = (segments: Segment[]): string => {
    const length = segments.reduce((sum, [text]) => sum + text.length, 0);
    const left = Math.floor((BOX_WIDTH - length) / 2);
    const right = BOX_WIDTH - length - left;
    const content = segments.map(([text, code]) => paint(code, text)).join("");
    return `  ${border("│")}${" ".repeat(left)}${content}${" ".repeat(right)}${border("│")}`;
  };
  const blank = row([]);

  return [
    "",
    `  ${border(`╭${"─".repeat(BOX_WIDTH)}╮`)}`,
    blank,
    row([
      [LOGO[0], INDIGO],
      [" ".repeat(blockWidth - logoWidth), ""],
    ]),
    row([
      [LOGO[1], INDIGO],
      [versionText, GRAY],
    ]),
    blank,
    row([[TAGLINE, GRAY]]),
    blank,
    `  ${border(`╰${"─".repeat(BOX_WIDTH)}╯`)}`,
    "",
  ].join("\n");
}

/** Lee la versión del package.json del paquete (junto a dist/ o src/). */
export function readVersion(): string {
  try {
    const url = new URL("../package.json", import.meta.url);
    const pkg = JSON.parse(readFileSync(url, "utf8")) as { version?: unknown };
    return typeof pkg.version === "string" ? pkg.version : "";
  } catch {
    // Solo afecta al texto decorativo del banner; no debe impedir ejecutar el CLI.
    return "";
  }
}
