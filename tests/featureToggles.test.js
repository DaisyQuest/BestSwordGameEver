import { describe, expect, it } from "vitest";
import { createFeatureToggles } from "../shared/featureToggles.js";

describe("featureToggles", () => {
  it("validates initial toggles", () => {
    expect(() => createFeatureToggles(null)).toThrow(TypeError);
    expect(() => createFeatureToggles([])).toThrow(TypeError);
    expect(() => createFeatureToggles({ limbLoss: "yes" })).toThrow(TypeError);
  });

  it("gets and sets toggles", () => {
    const toggles = createFeatureToggles({ limbLoss: true });
    expect(toggles.isEnabled("limbLoss")).toBe(true);
    expect(toggles.isEnabled("unknown")).toBe(false);

    toggles.set("limbLoss", false);
    toggles.set("organs", true);

    expect(toggles.isEnabled("limbLoss")).toBe(false);
    expect(toggles.isEnabled("organs")).toBe(true);
    expect(toggles.snapshot()).toEqual({ limbLoss: false, organs: true });
  });

  it("validates toggle keys and values", () => {
    const toggles = createFeatureToggles();
    expect(() => toggles.isEnabled(123)).toThrow(TypeError);
    expect(() => toggles.isEnabled("")).toThrow(TypeError);
    expect(() => toggles.set("", true)).toThrow(TypeError);
    expect(() => toggles.set("limbLoss", "yes")).toThrow(TypeError);
  });
});
