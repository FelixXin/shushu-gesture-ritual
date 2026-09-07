import { describe, expect, it } from "vitest";
import { initialLuopanState, reduceLuopanState } from "./luopan-state";

describe("luopan state transitions", () => {
  it("awakens from dormant into flat", () => {
    expect(reduceLuopanState(initialLuopanState, { type: "awaken" })).toMatchObject({ mode: "flat" });
  });

  it("uses a fist toggle only between flat and spatial", () => {
    const flat = reduceLuopanState(initialLuopanState, { type: "awaken" });
    expect(reduceLuopanState(flat, { type: "toggle-depth" })).toMatchObject({ mode: "spatial" });
    expect(reduceLuopanState(reduceLuopanState(flat, { type: "toggle-depth" }), { type: "toggle-depth" })).toMatchObject({ mode: "flat" });
  });

  it("locks a resolved primary hexagram in spatial mode", () => {
    expect(reduceLuopanState(initialLuopanState, { type: "reveal", hexagramNumber: 29 }))
      .toMatchObject({ mode: "spatial", highlightedHexagram: 29, highlightedAngle: 157.5 });
  });
});
