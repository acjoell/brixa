import express, { type Request, type Response, type NextFunction } from "express";
import { setupApiDocs } from "./docs/swagger.js";

export const app = express();

app.disable("x-powered-by");

app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

setupApiDocs(app);

// Manejo de errores centralizado (sin exponer trazas)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
});
