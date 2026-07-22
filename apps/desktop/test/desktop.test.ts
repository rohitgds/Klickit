import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { launchDesktopShell } from "../src/shell.ts";

describe("desktop shell", () => {
  it("launches browser fallback when Tauri APIs are unavailable", async () => {
    const result = await launchDesktopShell({ mode: "local-gateway", gatewayUrl: "http://127.0.0.1:8787" });
    assert.equal(result.started, true);
    assert.equal(result.provider, "browser-fallback");
  });
});
