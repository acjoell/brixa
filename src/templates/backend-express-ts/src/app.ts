import express, { type Request, type Response, type NextFunction } from "express";

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

// Manejo de errores centralizado (sin exponer trazas)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
});
