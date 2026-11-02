import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Ejecuta V2 (SSR) en un subproceso aislado para que Vite createServer
 * no contamine process.env.NODE_ENV del proceso padre del arnés.
 */
async function verifyV2SSR(frontendDir, language) {
  const v2Script = path.join(here, "verify-i18n-v2.js");
  // Construir entorno sin NODE_ENV para que Vite lo ponga en "production"
  const childEnv = { ...process.env };
  delete childEnv.NODE_ENV;
  execFileSync(process.execPath, [v2Script, frontendDir, language], {
    stdio: "inherit",
    env: childEnv,
  });
}

/**
 * Ejecuta V3 (localStorage/navigator) en un subproceso aislado para no
 * contaminar globalThis ni process.env del proceso padre del arnés.
 */
async function verifyV3StorageAndNavigator(frontendDir) {
  const v3Script = path.join(here, "verify-i18n-v3.js");
  const childEnv = { ...process.env };
  delete childEnv.NODE_ENV;
  execFileSync(process.execPath, [v3Script, frontendDir], {
    stdio: "inherit",
    env: childEnv,
  });
}

function verifyV4DistStrings(frontendDir) {
  const assetsDir = path.join(frontendDir, "dist", "assets");
  if (!fs.existsSync(assetsDir)) {
    throw new Error(`Directorio de assets ${assetsDir} no existe tras npm run build`);
  }
  const files = fs.readdirSync(assetsDir);
  const jsFiles = files.filter((f) => f.endsWith(".js"));
  if (jsFiles.length === 0) {
    throw new Error("No se encontraron archivos JS en dist/assets/");
  }

  let foundEn = false;
  let foundEs = false;

  for (const jsFile of jsFiles) {
    const content = fs.readFileSync(path.join(assetsDir, jsFile), "utf-8");
    if (content.includes("Get started")) foundEn = true;
    if (content.includes("Comenzar")) foundEs = true;
  }

  if (!foundEn) {
    throw new Error("Cadena distintiva de inglés ('Get started') no encontrada en dist/assets/");
  }
  if (!foundEs) {
    throw new Error("Cadena distintiva de español ('Comenzar') no encontrada en dist/assets/");
  }
}

export async function verifyI18n(frontendDir, language) {
  console.log(`\n--- Verificación i18n (V1–V4) en ${frontendDir} ---`);

  // V1. npm run check:i18n
  console.log("V1. Ejecutando check:i18n...");
  const isWindows = process.platform === "win32";
  const npmCmd = isWindows ? "npm.cmd" : "npm";
  execFileSync(npmCmd, ["run", "check:i18n"], {
    cwd: frontendDir,
    stdio: "inherit",
    shell: isWindows,
  });
  console.log("✔ V1. check:i18n completado con éxito.");

  // V2. SSR con Vite createServer en subproceso aislado (evita contaminación de NODE_ENV)
  const nodeEnvBefore = process.env.NODE_ENV;
  console.log("V2. Verificando SSR con Vite y react-dom/server (subproceso aislado)...");
  await verifyV2SSR(frontendDir, language);
  if (process.env.NODE_ENV !== nodeEnvBefore) {
    throw new Error(
      `[Arnés] NODE_ENV fue alterado por V2: era ${JSON.stringify(nodeEnvBefore)}, ahora es ${JSON.stringify(process.env.NODE_ENV)}. El aislamiento del subproceso no funcionó.`,
    );
  }
  console.log("✔ V2. SSR completado con éxito.");

  // V3. localStorage y navigator simulados en subproceso aislado
  console.log("V3. Verificando localStorage y navigator simulados (subproceso aislado)...");
  await verifyV3StorageAndNavigator(frontendDir);
  if (process.env.NODE_ENV !== nodeEnvBefore) {
    throw new Error(
      `[Arnés] NODE_ENV fue alterado por V3: era ${JSON.stringify(nodeEnvBefore)}, ahora es ${JSON.stringify(process.env.NODE_ENV)}. El aislamiento del subproceso no funcionó.`,
    );
  }
  console.log("✔ V3. localStorage y navigator completado con éxito.");

  // V4. Cadenas distintivas de en y es presentes en dist/
  console.log("V4. Verificando cadenas distintivas en dist/...");
  verifyV4DistStrings(frontendDir);
  console.log("✔ V4. Cadenas en dist/ completado con éxito.");
}
