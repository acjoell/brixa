import express from "express";
import { setupApiDocs } from "./docs/swagger.js";

export const app = express();

app.disable("x-powered-by");

app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

setupApiDocs(app);

// Manejo de errores centralizado (sin exponer trazas)
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal Server Error" });
});
