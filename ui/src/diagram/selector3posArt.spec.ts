import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  SELECTOR_3POS_ELEMENT_COUNTS,
  SELECTOR_3POS_ELEMENT_HASHES,
  SELECTOR_3POS_STATES
} from "./selector3posArt.generated";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("SELECTOR_3POS generated art", () => {
  for (const state of [1, 2, 3] as const) {
    it(`keeps every supplied element and hash for state ${state}`, () => {
      const elements = SELECTOR_3POS_STATES[state];
      const hashes = SELECTOR_3POS_ELEMENT_HASHES[state];

      expect(elements).toHaveLength(SELECTOR_3POS_ELEMENT_COUNTS[state]);
      expect(hashes).toHaveLength(elements.length);

      elements.forEach((element, index) => {
        const data = element.tag === "path" ? element.d : element.points;
        expect(data.length).toBeGreaterThan(0);
        expect(sha256(data)).toBe(hashes[index]);
      });
    });
  }
});
