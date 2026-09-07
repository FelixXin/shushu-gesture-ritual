import { describe, expect, it } from "vitest";
import { HEXAGRAM_SECTOR_COUNT, LUOPAN_LAYERS, hexagramSectorAngle, layerById } from "./luopan-data";

describe("luopan data", () => {
  it("keeps fourteen layers in their inner-to-outer order", () => {
    expect(LUOPAN_LAYERS.map(({ id }) => id)).toEqual([
      "taiji", "bagua", "luoshu-nine-stars", "heaven-stars", "earth-needle",
      "seventy-two-dragons", "human-needle", "sixty-dragons", "heaven-needle",
      "one-twenty-divisions", "hexagrams", "mansions", "solar-terms", "heavenly-degrees"
    ]);
  });

  it("maps every hexagram to one of sixty-four outer sectors", () => {
    expect(HEXAGRAM_SECTOR_COUNT).toBe(64);
    expect(hexagramSectorAngle(1)).toBe(0);
    expect(hexagramSectorAngle(29)).toBe(157.5);
    expect(hexagramSectorAngle(64)).toBe(354.375);
    expect(hexagramSectorAngle(65)).toBeUndefined();
  });

  it("exposes a sixty-four hexagram ring for result highlighting", () => {
    expect(layerById("hexagrams")).toMatchObject({ label: "六十四卦", tokenCount: 64 });
  });
});
