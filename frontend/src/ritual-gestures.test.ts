import { describe, expect, it } from "vitest";
import { ritualActionForGesture } from "./ritual-gestures";

describe("ritual gesture routing", () => {
  it("keeps scene depth and line casting separate", () => {
    expect(ritualActionForGesture("Closed_Fist", "flat")).toBe("toggle-depth");
    expect(ritualActionForGesture("Victory", "spatial")).toBe("cast-line");
    expect(ritualActionForGesture("Open_Palm", "spatial")).toBe("guide");
  });
});
