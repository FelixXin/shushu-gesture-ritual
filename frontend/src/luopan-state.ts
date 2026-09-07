import { hexagramSectorAngle } from "./luopan-data";

export type LuopanMode = "dormant" | "flat" | "spatial";

export type LuopanState = {
  mode: LuopanMode;
  highlightedHexagram: number | null;
  highlightedAngle: number | null;
};

export type LuopanAction =
  | { type: "awaken" }
  | { type: "toggle-depth" }
  | { type: "reveal"; hexagramNumber: number }
  | { type: "reset" };

export const initialLuopanState: LuopanState = {
  mode: "dormant",
  highlightedHexagram: null,
  highlightedAngle: null
};

export function reduceLuopanState(state: LuopanState, action: LuopanAction): LuopanState {
  if (action.type === "reset") return initialLuopanState;
  if (action.type === "awaken") return state.mode === "dormant" ? { ...state, mode: "flat" } : state;
  if (action.type === "toggle-depth") {
    if (state.mode === "flat") return { ...state, mode: "spatial" };
    if (state.mode === "spatial") return { ...state, mode: "flat" };
    return state;
  }
  const angle = hexagramSectorAngle(action.hexagramNumber);
  return angle === undefined ? state : {
    mode: "spatial",
    highlightedHexagram: action.hexagramNumber,
    highlightedAngle: angle
  };
}
