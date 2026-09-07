import { describe, expect, it } from "vitest";

type CompassModule = {
  createHexagramSectors: () => Array<{ number: number; name: string; angle: number }>;
  findHexagramSector: (number: number) => { number: number; name: string; angle: number } | undefined;
};

async function loadCompass(): Promise<CompassModule> {
  try {
    return await import("./compass") as CompassModule;
  } catch {
    return {
      createHexagramSectors: () => [],
      findHexagramSector: () => undefined
    };
  }
}

describe("luopan compass data", () => {
  it("lays all 64 hexagrams into evenly spaced outer sectors", async () => {
    const { createHexagramSectors } = await loadCompass();

    const sectors = createHexagramSectors();

    expect(sectors).toHaveLength(64);
    expect(sectors[0]).toEqual({ number: 1, name: "乾", angle: 0 });
    expect(sectors[1]?.angle).toBe(5.625);
    expect(sectors.at(-1)).toEqual({ number: 64, name: "未济", angle: 354.375 });
  });

  it("finds the single outer sector to illuminate after a hexagram resolves", async () => {
    const { findHexagramSector } = await loadCompass();

    expect(findHexagramSector(29)).toEqual({ number: 29, name: "坎", angle: 157.5 });
    expect(findHexagramSector(65)).toBeUndefined();
  });
});
