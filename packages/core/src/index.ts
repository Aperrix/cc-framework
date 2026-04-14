/** Public API surface for @cc-framework/core. */

// ---- Config ----
export { loadConfig, initProject, ensureGlobalHome } from "./config/loader.ts";
export { CONFIG_DEFAULTS, toSafeConfig } from "./config/types.ts";
export type { GlobalConfig, ProjectConfig, ResolvedConfig, SafeConfig } from "./config/types.ts";

// ---- Store Adapter ----
export { toWorkflowConfig } from "./store-adapter.ts";
