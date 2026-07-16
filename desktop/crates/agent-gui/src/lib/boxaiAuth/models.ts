// BOXAI: model catalog for the locked BoxAI providers.
//
// The live catalog is fetched from <server>/v1/models (the gateway returns the
// models the signed-in account is entitled to; both transports serve the same
// set) and cached locally. The curated lists below are only a fallback for
// first boot / offline; edit them to match your deployment if needed.

export const BOXAI_CLAUDE_MODELS: readonly string[] = [
  "claude-sonnet-4-5-20250929",
  "claude-opus-4-1-20250805",
  "claude-3-5-haiku-20241022",
];

export const BOXAI_OPENAI_MODELS: readonly string[] = ["gpt-4o", "gpt-4o-mini", "gpt-4.1"];

// Model IDs the gateway advertises for the signed-in account.
export type BoxAIModelCatalog = string[];

const CATALOG_STORAGE_KEY = "boxai_desktop_model_catalog_v1";

export function loadCachedCatalog(serverUrl: string): BoxAIModelCatalog | null {
  try {
    const raw = localStorage.getItem(CATALOG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { serverUrl?: unknown; models?: unknown };
    if (parsed.serverUrl !== serverUrl || !Array.isArray(parsed.models)) return null;
    const models = parsed.models.filter(
      (id): id is string => typeof id === "string" && id.trim().length > 0,
    );
    return models.length > 0 ? models : null;
  } catch {
    return null;
  }
}

export function saveCachedCatalog(serverUrl: string, catalog: BoxAIModelCatalog): void {
  try {
    localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify({ serverUrl, models: catalog }));
  } catch {
    // Cache write failures are non-fatal; the fallback lists still apply.
  }
}

export function clearCachedCatalog(): void {
  localStorage.removeItem(CATALOG_STORAGE_KEY);
}
