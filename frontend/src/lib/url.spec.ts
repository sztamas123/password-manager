import { describe, expect, it } from "vitest";
import { getSafeExternalUrl } from "./url";

describe("getSafeExternalUrl", () => {
  it("allows HTTP and HTTPS websites", () => {
    expect(getSafeExternalUrl("https://example.com")).toBe(
      "https://example.com/",
    );
    expect(getSafeExternalUrl("http://localhost:3000/path")).toBe(
      "http://localhost:3000/path",
    );
  });

  it("rejects script URLs and malformed values", () => {
    expect(getSafeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(getSafeExternalUrl("not a url")).toBeNull();
  });
});
