// BOXAI: builds the locked BoxAI providers from the account session.
//
// BoxAI is exposed as two locked provider entries sharing one account
// credential (the JWT access token), one per transport the gateway speaks:
//   - BoxAI (Claude):  Anthropic-compatible  <server>/v1/messages
//   - BoxAI (OpenAI):  OpenAI-compatible      <server>/v1/chat/completions
// Users cannot add or edit providers; these are reconciled from the session.

import {
  type CustomProvider,
  createProviderModelConfig,
  normalizeCustomProvider,
} from "../settings";
import { BOXAI_CLAUDE_MODELS, BOXAI_OPENAI_MODELS, type BoxAIModelCatalog } from "./models";
import type { BoxAISession } from "./session";

export const BOXAI_CLAUDE_PROVIDER_ID = "boxai-claude";
export const BOXAI_OPENAI_PROVIDER_ID = "boxai-openai";

function buildProvider(
  id: string,
  name: string,
  type: "claude_code" | "codex",
  modelIds: readonly string[],
  session: BoxAISession,
): CustomProvider {
  return {
    id,
    name,
    type,
    baseUrl: `${session.serverUrl}/v1`,
    apiKey: session.accessToken,
    apiKeyConfigured: true,
    models: modelIds.map((modelId) => createProviderModelConfig(type, modelId)),
    activeModels: [...modelIds],
    requestFormat: type === "codex" ? "openai-completions" : undefined,
    reasoning: "off",
    promptCachingEnabled: type === "claude_code",
    nativeWebSearchEnabled: true,
  };
}

// Both transports serve the same account-entitled model set, so a fetched
// catalog applies to both entries; curated lists are the offline fallback.
export function buildBoxAIProviders(
  session: BoxAISession,
  catalog?: BoxAIModelCatalog | null,
): CustomProvider[] {
  const models = catalog && catalog.length > 0 ? catalog : null;
  return [
    buildProvider(
      BOXAI_CLAUDE_PROVIDER_ID,
      "BoxAI (Claude)",
      "claude_code",
      models ?? BOXAI_CLAUDE_MODELS,
      session,
    ),
    buildProvider(
      BOXAI_OPENAI_PROVIDER_ID,
      "BoxAI (OpenAI)",
      "codex",
      models ?? BOXAI_OPENAI_MODELS,
      session,
    ),
  ];
}

function providerSignature(provider: CustomProvider | undefined): string {
  if (!provider) return "";
  return [
    provider.id,
    provider.type,
    provider.baseUrl,
    provider.apiKey,
    provider.activeModels.join(","),
  ].join("|");
}

// True when the persisted providers already match what the session should seed,
// so the reconcile effect can no-op (avoids a settings write/render loop).
export function providersMatchSession(
  providers: CustomProvider[],
  session: BoxAISession,
  catalog?: BoxAIModelCatalog | null,
): boolean {
  const desired = buildBoxAIProviders(session, catalog).map(normalizeCustomProvider);
  if (providers.length !== desired.length) return false;
  return desired.every(
    (want, index) => providerSignature(providers[index]) === providerSignature(want),
  );
}
