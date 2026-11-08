import express, { type Request, type Response, type NextFunction } from "express";
import { inspect } from "node:util";
import { setupApiDocs } from "./docs/swagger.js";
import { redact } from "./redact.js";

try {
  process.loadEnvFile();
} catch (err: unknown) {
  if (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code !== "ENOENT"
  ) {
    throw err;
  }
}

export const app = express();

app.disable("x-powered-by");

app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

setupApiDocs(app);

// Manejo de errores centralizado (sin exponer trazas al cliente y con redacción en logs)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(redact(inspect(err, { depth: 5 })));
  res.status(500).json({ error: "Internal Server Error" });
});
