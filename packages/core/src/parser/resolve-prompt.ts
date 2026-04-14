import { readFile } from "node:fs/promises";
import { join, isAbsolute } from "node:path";

function isFilePath(value: string): boolean {
  return value.endsWith(".md") || value.startsWith("./") || value.startsWith("/");
}

export async function resolvePrompt(value: string, projectRoot: string): Promise<string> {
  if (!isFilePath(value)) {
    return value;
  }

  if (isAbsolute(value)) {
    return readFile(value, "utf-8");
  }

  const promptsDir = join(projectRoot, "prompts");
  const candidates = [join(promptsDir, value), join(projectRoot, value)];

  for (const candidate of candidates) {
    try {
      return await readFile(candidate, "utf-8");
    } catch {
      continue;
    }
  }

  throw new Error(`Prompt file not found: "${value}" (searched in ${candidates.join(", ")})`);
}
