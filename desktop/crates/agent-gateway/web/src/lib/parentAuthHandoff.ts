export type AgentAuthRequestMessage = {
  type: "boxai.agent.auth.request";
  version: 1;
};

type AgentAuthTokenMessage = {
  type: "boxai.agent.auth.token";
  version: 1;
  token: string | null;
};

export type AgentParentAuthResult =
  | { kind: "ignored" }
  | { kind: "clear" }
  | { kind: "verified"; token: string };

export function configuredAgentParentOrigin(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    return url.origin === trimmed.replace(/\/$/, "") ? url.origin : null;
  } catch {
    return null;
  }
}

function isAgentAuthTokenMessage(value: unknown): value is AgentAuthTokenMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<AgentAuthTokenMessage>;
  return (
    message.type === "boxai.agent.auth.token" &&
    message.version === 1 &&
    (typeof message.token === "string" || message.token === null) &&
    Object.keys(value).length === 3
  );
}

export function isTrustedAgentParentAuthMessage(
  event: Pick<MessageEvent<unknown>, "data" | "origin" | "source">,
  expectedSource: MessageEventSource,
  expectedOrigin: string,
): boolean {
  return (
    event.source === expectedSource &&
    event.origin === expectedOrigin &&
    isAgentAuthTokenMessage(event.data)
  );
}

export async function resolveAgentParentAuthMessage(
  event: Pick<MessageEvent<unknown>, "data" | "origin" | "source">,
  expectedSource: MessageEventSource,
  expectedOrigin: string,
  normalizeToken: (token: string) => string,
  verifyToken: (token: string) => Promise<string>,
): Promise<AgentParentAuthResult> {
  if (!isTrustedAgentParentAuthMessage(event, expectedSource, expectedOrigin)) {
    return { kind: "ignored" };
  }

  const message = event.data as AgentAuthTokenMessage;
  const nextToken = normalizeToken(message.token ?? "");
  if (!nextToken) return { kind: "clear" };
  return { kind: "verified", token: await verifyToken(nextToken) };
}
