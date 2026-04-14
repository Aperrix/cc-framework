import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULTS_DIR = dirname(fileURLToPath(import.meta.url));
