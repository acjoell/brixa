import express, { type Request, type Response } from "express";
// @@INSERT:imports@@
import { errorHandler, notFoundHandler } from "./errors.js";

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

// @@INSERT:routes@@
app.use(notFoundHandler);
app.use(errorHandler);
