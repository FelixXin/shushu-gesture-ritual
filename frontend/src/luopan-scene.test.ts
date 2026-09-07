import { describe, expect, it } from "vitest";
import { sceneTransitionFor } from "./luopan-scene";

describe("luopan scene contract", () => {
  it("pulses the hexagram layer when a line is cast", () => {
    expect(sceneTransitionFor({ mode: "flat", highlightedHexagram: null, highlightedAngle: null }, { type: "cast-line", index: 3 }))
      .toMatchObject({ nextMode: "flat", pulseLayer: "hexagrams", lineIndex: 3 });
  });

  it("accepts palm guidance only in spatial mode", () => {
    expect(sceneTransitionFor({ mode: "flat", highlightedHexagram: null, highlightedAngle: null }, { type: "guide", x: 0.7, y: 0.2, roll: 0.4 }))
      .toMatchObject({ acceptsGuide: false });
    expect(sceneTransitionFor({ mode: "spatial", highlightedHexagram: null, highlightedAngle: null }, { type: "guide", x: 0.7, y: 0.2, roll: 0.4 }))
      .toMatchObject({ acceptsGuide: true });
  });
});
