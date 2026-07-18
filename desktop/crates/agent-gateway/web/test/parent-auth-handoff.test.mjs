import assert from "node:assert/strict";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createWebModuleLoader } from "../../test/helpers/load-web-module.mjs";

const loader = createWebModuleLoader({
  rootDir: fileURLToPath(new URL("../", import.meta.url)),
});
const { configuredAgentParentOrigin, resolveAgentParentAuthMessage } = loader.loadModule(
  "src/lib/parentAuthHandoff.ts",
);

const parent = {};
const origin = "https://you-box.com";
const normalize = (token) => token.trim().replace(/^Bearer\s+/i, "");

function message(overrides = {}) {
  return {
    source: parent,
    origin,
    data: { type: "boxai.agent.auth.token", version: 1, token: " account-jwt " },
    ...overrides,
  };
}

test("configured parent origin accepts only an exact origin", () => {
  assert.equal(configuredAgentParentOrigin("https://you-box.com"), origin);
  assert.equal(configuredAgentParentOrigin("https://you-box.com/"), origin);
  assert.equal(configuredAgentParentOrigin("https://you-box.com/app"), null);
  assert.equal(configuredAgentParentOrigin("not a URL"), null);
  assert.equal(configuredAgentParentOrigin(undefined), null);
});

test("parent handoff ignores wrong origins, sources, and message shapes", async () => {
  let verifyCalls = 0;
  const verify = async (token) => {
    verifyCalls += 1;
    return token;
  };
  const cases = [
    message({ origin: "https://evil.example" }),
    message({ source: {} }),
    message({ data: { type: "boxai.agent.auth.token", version: 1, token: "jwt", extra: true } }),
    message({ data: { type: "boxai.agent.auth.token", version: 2, token: "jwt" } }),
    message({ data: { type: "boxai.agent.auth.token", version: 1, token: 123 } }),
  ];

  for (const event of cases) {
    assert.deepEqual(
      await resolveAgentParentAuthMessage(event, parent, origin, normalize, verify),
      { kind: "ignored" },
    );
  }
  assert.equal(verifyCalls, 0);
});

test("valid handoff verifies the normalized token without any persistence dependency", async () => {
  const verified = [];
  const result = await resolveAgentParentAuthMessage(
    message(),
    parent,
    origin,
    normalize,
    async (token) => {
      verified.push(token);
      return `verified:${token}`;
    },
  );

  assert.deepEqual(verified, ["account-jwt"]);
  assert.deepEqual(result, { kind: "verified", token: "verified:account-jwt" });
});

test("null or empty parent token clears the in-memory session without verification", async () => {
  let verified = false;
  const verify = async () => {
    verified = true;
    return "unexpected";
  };

  assert.deepEqual(
    await resolveAgentParentAuthMessage(
      message({ data: { type: "boxai.agent.auth.token", version: 1, token: null } }),
      parent,
      origin,
      normalize,
      verify,
    ),
    { kind: "clear" },
  );
  assert.deepEqual(
    await resolveAgentParentAuthMessage(
      message({ data: { type: "boxai.agent.auth.token", version: 1, token: "  " } }),
      parent,
      origin,
      normalize,
      verify,
    ),
    { kind: "clear" },
  );
  assert.equal(verified, false);
});
