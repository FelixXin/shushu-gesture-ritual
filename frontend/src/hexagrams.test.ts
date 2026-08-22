import { describe, expect, it } from "vitest";

type HexagramModule = {
  HEXAGRAM_NAMES: readonly string[];
  castCoinLine: (randomByte: number) => number;
  linePresentation: (value: number) => { kind: string; moving: boolean };
};

async function loadHexagrams(): Promise<HexagramModule> {
  try {
    return await import("./hexagrams") as HexagramModule;
  } catch {
    return {
      HEXAGRAM_NAMES: [],
      castCoinLine: () => 0,
      linePresentation: () => ({ kind: "missing", moving: false })
    };
  }
}

describe("hexagram interaction data", () => {
  it("provides all 64 King Wen hexagram names in order", async () => {
    const { HEXAGRAM_NAMES } = await loadHexagrams();

    expect(HEXAGRAM_NAMES).toHaveLength(64);
    expect(HEXAGRAM_NAMES.slice(0, 4)).toEqual(["乾", "坤", "屯", "蒙"]);
    expect(HEXAGRAM_NAMES.slice(-2)).toEqual(["既济", "未济"]);
  });

  it.each([
    [0b000, 6],
    [0b001, 7],
    [0b011, 8],
    [0b111, 9]
  ])("maps three unbiased coin bits %i to line value %i", async (randomByte, expected) => {
    const { castCoinLine } = await loadHexagrams();

    expect(castCoinLine(randomByte)).toBe(expected);
  });

  it("marks old yin and old yang as moving lines", async () => {
    const { linePresentation } = await loadHexagrams();

    expect(linePresentation(6)).toEqual({ kind: "yin", moving: true });
    expect(linePresentation(7)).toEqual({ kind: "yang", moving: false });
    expect(linePresentation(8)).toEqual({ kind: "yin", moving: false });
    expect(linePresentation(9)).toEqual({ kind: "yang", moving: true });
  });
});
