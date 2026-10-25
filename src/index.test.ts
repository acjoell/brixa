import { describe, it, expect } from "vitest";
import { main } from "./index.js";

describe("smoke test", () => {
  it("main is a function", () => {
    expect(typeof main).toBe("function");
  });

  it("main does not throw", () => {
    expect(() => main()).not.toThrow();
  });
});
