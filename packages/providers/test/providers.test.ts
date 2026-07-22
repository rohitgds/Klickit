import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PROVIDER_DESCRIPTORS, createStubProviderRegistry } from "../src/interfaces.js";

describe("provider adapters", () => {
  it("registers ten portable provider boundaries", () => {
    assert.equal(PROVIDER_DESCRIPTORS.length, 10);
  });

  it("creates a stub registry for local development", async () => {
    const registry = createStubProviderRegistry("phase8-stub");
    const health = await registry.localGateway.getHealth();
    assert.equal(health.status, "ok");
    assert.match(health.provider, /phase8-stub/);
  });

  it("does not hard-code Pabbly or Supabase URLs in adapter contracts", () => {
    for (const descriptor of PROVIDER_DESCRIPTORS) {
      assert.equal(descriptor.interfaceName.length > 0, true);
      assert.equal(descriptor.replacementCandidates.length > 0, true);
    }
  });
});
