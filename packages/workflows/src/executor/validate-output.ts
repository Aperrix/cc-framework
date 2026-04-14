/** Validates node output against the declared output_format JSON schema. */

import type { Node } from "../schema/node.ts";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a node's output against its output_format schema.
 * If the node has no output_format, the output is always valid.
 *
 * Checks:
 * 1. Output must be valid JSON
 * 2. Required fields from the schema must be present
 * 3. Enum fields must match allowed values
 */
export function validateNodeOutput(node: Node, output: string): ValidationResult {
  if (!node.output_format) {
    return { valid: true, errors: [] };
  }

  const errors: string[] = [];

  // Step 1: Must be valid JSON
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(output);
  } catch {
    return {
      valid: false,
      errors: [`Output is not valid JSON: ${output.slice(0, 200)}`],
    };
  }

  // Step 2: Must be an object
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      valid: false,
      errors: ["Output must be a JSON object"],
    };
  }

  const schema = node.output_format;

  // Step 3: Check required fields
  const requiredFields = schema.required;
  if (Array.isArray(requiredFields)) {
    for (const field of requiredFields) {
      if (typeof field === "string" && !(field in parsed)) {
        errors.push(`Missing required field: "${field}"`);
      }
    }
  }

  // Step 4: Check property types and enums (when properties are defined)
  if (schema.properties) {
    for (const [key, propSchema] of Object.entries(schema.properties)) {
      if (!(key in parsed)) continue;
      const value = parsed[key];
      const prop = propSchema as Record<string, unknown>;

      // Type check
      if (prop.type === "string" && typeof value !== "string") {
        errors.push(`Field "${key}" must be a string, got ${typeof value}`);
      } else if (prop.type === "number" && typeof value !== "number") {
        errors.push(`Field "${key}" must be a number, got ${typeof value}`);
      } else if (prop.type === "boolean" && typeof value !== "boolean") {
        errors.push(`Field "${key}" must be a boolean, got ${typeof value}`);
      }

      // Enum check
      if (prop.enum && Array.isArray(prop.enum)) {
        if (!prop.enum.includes(value)) {
          errors.push(
            `Field "${key}" must be one of [${prop.enum.join(", ")}], got "${String(value)}"`,
          );
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
