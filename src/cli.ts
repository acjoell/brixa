/**
 * Brixa — ejecutor del CLI.
 *
 * Único archivo con process.exit. Invoca main() y sale con el código devuelto.
 */
import { main } from "./index.js";

process.exit(await main());
