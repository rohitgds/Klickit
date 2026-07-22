import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateSyntheticDrKlickRows } from "../src/index.js";

describe("@klickit/test-fixtures", () => {
  it("generates deterministic synthetic DrKlick rows", () => {
    const rows = generateSyntheticDrKlickRows(3);
    assert.equal(rows.length, 3);
    assert.equal(rows[0]?.sourcePatientKey, "DRK-SYN-00001");
    assert.match(rows[1]?.mobile ?? "", /^9/);
  });
});
