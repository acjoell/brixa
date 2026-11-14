import { app } from "./app.js";
import { parseConfig } from "./config.js";
import { redact } from "./redact.js";
// @@INSERT:imports@@

try {
  process.loadEnvFile();
} catch (err) {
  if (err.code !== "ENOENT") {
    throw err;
  }
}

let port;
try {
  // @@INSERT:startup@@
  const config = parseConfig(process.env);
  port = config.port;
} catch (err) {
  console.error(redact(err instanceof Error ? err.message : String(err)));
  process.exit(1);
}

const server = app.listen(port, () => {
  const addr = server.address();
  const actualPort = typeof addr === "object" && addr ? addr.port : port;
  console.log(`Servidor escuchando en http://localhost:${actualPort}`);
});

function handleShutdown(signal) {
  console.log(`\nSeñal ${signal} recibida. Cerrando servidor ordenadamente...`);
  server.close((err) => {
    if (err) {
      console.error(
        "Error al cerrar el servidor:",
        redact(err instanceof Error ? err.message : String(err)),
      );
      process.exit(1);
    }
    console.log("Servidor cerrado.");
    process.exit(0);
  });
}

process.on("SIGINT", () => {
  handleShutdown("SIGINT");
});
process.on("SIGTERM", () => {
  handleShutdown("SIGTERM");
});
