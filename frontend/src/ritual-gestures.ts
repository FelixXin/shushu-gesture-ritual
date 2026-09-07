import type { LuopanMode } from "./luopan-state";

export type RitualAction = "awaken" | "toggle-depth" | "cast-line" | "guide" | null;

export function ritualActionForGesture(category: string, mode: LuopanMode): RitualAction {
  if (category === "Pointing_Up" && mode === "dormant") return "awaken";
  if (category === "Closed_Fist" && mode !== "dormant") return "toggle-depth";
  if (category === "Victory") return "cast-line";
  if (category === "Open_Palm" && mode === "spatial") return "guide";
  return null;
}

export function shouldTriggerGesture(previous: string, next: string, heldMs: number): boolean {
  return previous !== next && heldMs >= 650;
}
