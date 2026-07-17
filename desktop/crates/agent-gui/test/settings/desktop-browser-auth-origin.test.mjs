import assert from "node:assert/strict";
import test from "node:test";
import { createTsModuleLoader } from "../helpers/load-ts-module.mjs";

const loader = createTsModuleLoader({
  // login.ts imports @tauri-apps/plugin-opener — mock openUrl for unit load.
  mocks: {
    "@tauri-apps/plugin-opener": {
      openUrl: async () => {},
    },
  },
});

const {
  PRODUCTION_BROWSER_AUTH_ORIGIN,
  resolveDesktopBrowserAuthOrigin,
} = loader.loadModule("src/lib/boxaiAuth/login.ts");

test("maps production api/console/apex hosts to you-box.com", () => {
  assert.equal(resolveDesktopBrowserAuthOrigin("https://api.you-box.com"), PRODUCTION_BROWSER_AUTH_ORIGIN);
  assert.equal(resolveDesktopBrowserAuthOrigin("https://console.you-box.com"), PRODUCTION_BROWSER_AUTH_ORIGIN);
  assert.equal(resolveDesktopBrowserAuthOrigin("https://you-box.com"), PRODUCTION_BROWSER_AUTH_ORIGIN);
  assert.equal(resolveDesktopBrowserAuthOrigin("https://www.you-box.com"), PRODUCTION_BROWSER_AUTH_ORIGIN);
  assert.equal(
    resolveDesktopBrowserAuthOrigin("https://api.you-box.com/"),
    PRODUCTION_BROWSER_AUTH_ORIGIN,
  );
});

test("passes through self-hosted and unknown hosts", () => {
  assert.equal(resolveDesktopBrowserAuthOrigin("https://boxai.example.com"), "https://boxai.example.com");
  assert.equal(resolveDesktopBrowserAuthOrigin("http://localhost:8080"), "http://localhost:8080");
  assert.equal(
    resolveDesktopBrowserAuthOrigin("https://boxai.example.com/v1/"),
    "https://boxai.example.com/v1",
  );
});

test("does not remap lookalike hosts (open-redirect resistance)", () => {
  assert.equal(
    resolveDesktopBrowserAuthOrigin("https://api.you-box.com.evil"),
    "https://api.you-box.com.evil",
  );
  assert.equal(
    resolveDesktopBrowserAuthOrigin("https://console.you-box.com.attacker.example"),
    "https://console.you-box.com.attacker.example",
  );
  assert.equal(
    resolveDesktopBrowserAuthOrigin("https://not-you-box.com"),
    "https://not-you-box.com",
  );
});

test("invalid URL falls through without throwing", () => {
  assert.equal(resolveDesktopBrowserAuthOrigin("not a url"), "not a url");
  assert.equal(resolveDesktopBrowserAuthOrigin(""), "");
});
