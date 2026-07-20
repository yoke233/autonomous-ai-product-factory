import { describe, expect, it } from "vitest";
import { FACTORY_DESIGN_REVISION } from "./index.js";

describe("scaffold", () => {
  it("tracks the frozen design revision", () => {
    expect(FACTORY_DESIGN_REVISION).toBe("v0.6");
  });
});
