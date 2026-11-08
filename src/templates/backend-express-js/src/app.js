import express from "express";
// @@INSERT:imports@@
import { errorHandler, notFoundHandler } from "./errors.js";

try {
  process.loadEnvFile();
} catch (err) {
  if (err.code !== "ENOENT") {
    throw err;
  }
}

export const app = express();

app.disable("x-powered-by");

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// @@INSERT:routes@@
app.use(notFoundHandler);
app.use(errorHandler);
