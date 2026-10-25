import { app } from "./app.js";

try {
  process.loadEnvFile();
} catch (err) {
  if (err.code !== "ENOENT") {
    throw err;
  }
}

const DEFAULT_PORT = 3000;

function parsePort(val) {
  if (!val) {
    return DEFAULT_PORT;
  }
  const port = Number(val);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`Puerto inválido: "${val}". Debe ser un número entero entre 0 y 65535.`);
  }
  return port;
}

let port;
try {
  port = parsePort(process.env.PORT);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
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
      console.error("Error al cerrar el servidor:", err);
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
