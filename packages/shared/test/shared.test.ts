import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PRODUCT_NAME, createHealthResponse } from "../src/index.ts";

describe("shared constants", () => {
  it("uses the KlickIt product name", () => {
    assert.equal(PRODUCT_NAME, "KlickIt");
  });

  it("creates a health response", () => {
    const response = createHealthResponse("shared");
    assert.equal(response.product, "KlickIt");
    assert.equal(response.component, "shared");
    assert.equal(response.status, "ok");
    assert.match(response.timestamp, /^\d{4}-\d{2}-\d{2}T/);
  });
});
