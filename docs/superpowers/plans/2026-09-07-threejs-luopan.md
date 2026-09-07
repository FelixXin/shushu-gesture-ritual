# Three.js 14 层罗盘 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an original 14-layer Three.js luopan that opens into 3D through hand gestures while retaining the existing six-line divination flow.

**Architecture:** Static luopan content and state transitions live in pure TypeScript modules that Vitest can exercise without a browser. A dedicated Three.js scene owns WebGL, CanvasTexture ring rendering and animation, while `main.ts` only translates MediaPipe categories into tested ritual actions and keeps the FastAPI result flow intact.

**Tech Stack:** TypeScript, Vite, Vitest, Three.js `0.185.1`, MediaPipe Tasks Vision, FastAPI, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-07-threejs-luopan-design.md`

## Global Constraints

- Implement an original scene; do not copy code, shaders, textures, sound, text, or media from `huzoukai/hui-gesture-bagua`.
- Preserve `/api/v1/hexagrams/resolve`, existing request/response fields, the right-side result panel, and manual line generation.
- The 14 named layers must preserve a common center and fixed radii; 3D state may only move layers along predefined Z depth.
- Map `Pointing_Up` to awakening, `Closed_Fist` to flat/3D toggling, `Open_Palm` to 3D guidance, and `Victory` to a debounced line cast.
- Auto-expand to 3D and lock the resolved primary hexagram after the sixth line.
- Respect reduced motion and provide a functional CSS fallback when WebGL initialization fails.
- Verify on desktop and mobile, then deploy the built static frontend with the existing offline Docker Compose service.

---

### Task 1: Install Three.js and Define the Luopan Data Model

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/pnpm-lock.yaml`
- Create: `frontend/src/luopan-data.ts`
- Create: `frontend/src/luopan-data.test.ts`

**Interfaces:**
- Produces `LuopanLayer`, `LUOPAN_LAYERS`, `HEXAGRAM_SECTOR_COUNT`, `hexagramSectorAngle(number)` and `layerById(id)`.
- Consumes `HEXAGRAM_NAMES` from `frontend/src/hexagrams.ts`.
- Later tasks consume the layer list and `hexagramSectorAngle` without duplicating traditional ring order.

- [ ] **Step 1: Write the failing luopan data tests**

```ts
import { describe, expect, it } from "vitest";
import {
  HEXAGRAM_SECTOR_COUNT,
  LUOPAN_LAYERS,
  hexagramSectorAngle,
  layerById
} from "./luopan-data";

describe("luopan data", () => {
  it("keeps the fourteen rings in the designed inner-to-outer order", () => {
    expect(LUOPAN_LAYERS.map(({ id }) => id)).toEqual([
      "taiji", "bagua", "luoshu-nine-stars", "heaven-stars",
      "earth-needle", "seventy-two-dragons", "human-needle", "sixty-dragons",
      "heaven-needle", "one-twenty-divisions", "hexagrams", "mansions",
      "solar-terms", "heavenly-degrees"
    ]);
  });

  it("maps every hexagram number to a unique 64-sector angle", () => {
    expect(HEXAGRAM_SECTOR_COUNT).toBe(64);
    expect(hexagramSectorAngle(1)).toBe(0);
    expect(hexagramSectorAngle(29)).toBe(157.5);
    expect(hexagramSectorAngle(64)).toBe(354.375);
    expect(hexagramSectorAngle(65)).toBeUndefined();
  });

  it("exposes the dedicated hexagram ring for result highlighting", () => {
    expect(layerById("hexagrams")).toMatchObject({ label: "六十四卦", tokenCount: 64 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --dir frontend test luopan-data.test.ts`

Expected: FAIL because `./luopan-data` does not exist.

- [ ] **Step 3: Add the dependency and the minimal data module**

Run: `pnpm --dir frontend add three@0.185.1`

Create a typed layer array with these fields:

```ts
export type LuopanLayer = {
  id: string;
  label: string;
  innerRadius: number;
  outerRadius: number;
  spatialDepth: number;
  tokenCount: number;
};

export const HEXAGRAM_SECTOR_COUNT = 64;

export function hexagramSectorAngle(number: number): number | undefined {
  if (!Number.isInteger(number) || number < 1 || number > HEXAGRAM_SECTOR_COUNT) return undefined;
  return (number - 1) * (360 / HEXAGRAM_SECTOR_COUNT);
}
```

Populate `LUOPAN_LAYERS` with all fourteen IDs in the tested order, strictly increasing radii, and unique `spatialDepth` values. Use the existing `HEXAGRAM_NAMES` for the sixty-four-hexagram layer; define the remaining labels in the new module.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --dir frontend test luopan-data.test.ts`

Expected: PASS with 3 tests.

- [ ] **Step 5: Commit the data layer**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/src/luopan-data.ts frontend/src/luopan-data.test.ts
git commit -m "feat: add luopan scene data"
```

### Task 2: Define and Test the Ritual Scene State Machine

**Files:**
- Create: `frontend/src/luopan-state.ts`
- Create: `frontend/src/luopan-state.test.ts`

**Interfaces:**
- Consumes `hexagramSectorAngle` from `luopan-data.ts`.
- Produces `LuopanMode`, `LuopanState`, `LuopanAction`, `initialLuopanState`, and `reduceLuopanState(state, action)`.
- Later tasks call `reduceLuopanState` before mutating Three.js meshes or updating visual hints.

- [ ] **Step 1: Write the failing state transition tests**

```ts
import { describe, expect, it } from "vitest";
import { initialLuopanState, reduceLuopanState } from "./luopan-state";

describe("luopan state transitions", () => {
  it("awakens from dormant into the readable flat state", () => {
    expect(reduceLuopanState(initialLuopanState, { type: "awaken" })).toMatchObject({ mode: "flat" });
  });

  it("uses a fist toggle to move only between flat and spatial", () => {
    const flat = reduceLuopanState(initialLuopanState, { type: "awaken" });
    expect(reduceLuopanState(flat, { type: "toggle-depth" })).toMatchObject({ mode: "spatial" });
    expect(reduceLuopanState(reduceLuopanState(flat, { type: "toggle-depth" }), { type: "toggle-depth" })).toMatchObject({ mode: "flat" });
  });

  it("locks the primary hexagram and forces spatial display after resolution", () => {
    const next = reduceLuopanState(initialLuopanState, { type: "reveal", hexagramNumber: 29 });
    expect(next).toMatchObject({ mode: "spatial", highlightedHexagram: 29, highlightedAngle: 157.5 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --dir frontend test luopan-state.test.ts`

Expected: FAIL because `./luopan-state` does not exist.

- [ ] **Step 3: Implement the pure state reducer**

```ts
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
```

`awaken` changes only `dormant` to `flat`; `toggle-depth` switches only `flat` and `spatial`; `reveal` uses `hexagramSectorAngle`, sets `spatial`, and ignores invalid hexagram numbers; `reset` returns `initialLuopanState`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --dir frontend test luopan-state.test.ts`

Expected: PASS with 3 tests.

- [ ] **Step 5: Commit the scene state machine**

```bash
git add frontend/src/luopan-state.ts frontend/src/luopan-state.test.ts
git commit -m "feat: add luopan state machine"
```

### Task 3: Build the Original Three.js 14-Layer Scene

**Files:**
- Create: `frontend/src/luopan-scene.ts`
- Create: `frontend/src/luopan-scene.test.ts`

**Interfaces:**
- Consumes `LUOPAN_LAYERS`, `LuopanState`, and `reduceLuopanState`.
- Produces `createLuopanScene(canvas): LuopanScene`.
- `LuopanScene` methods are `awaken()`, `toggleDepth()`, `guide({ x, y, roll })`, `castLine(index)`, `revealHexagram(number)`, `reset()`, `resize()`, and `dispose()`.
- Task 4 calls only this interface; it must not manipulate scene meshes directly.

- [ ] **Step 1: Write the failing scene contract tests**

```ts
import { describe, expect, it } from "vitest";
import { sceneTransitionFor } from "./luopan-scene";

describe("luopan scene contract", () => {
  it("makes a cast pulse without changing the scene mode", () => {
    expect(sceneTransitionFor({ mode: "flat", highlightedHexagram: null, highlightedAngle: null }, { type: "cast-line", index: 3 }))
      .toMatchObject({ nextMode: "flat", pulseLayer: "hexagrams", lineIndex: 3 });
  });

  it("guides only an expanded spatial scene", () => {
    expect(sceneTransitionFor({ mode: "flat", highlightedHexagram: null, highlightedAngle: null }, { type: "guide", x: 0.7, y: 0.2, roll: 0.4 }))
      .toMatchObject({ acceptsGuide: false });
    expect(sceneTransitionFor({ mode: "spatial", highlightedHexagram: null, highlightedAngle: null }, { type: "guide", x: 0.7, y: 0.2, roll: 0.4 }))
      .toMatchObject({ acceptsGuide: true });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --dir frontend test luopan-scene.test.ts`

Expected: FAIL because `./luopan-scene` does not exist.

- [ ] **Step 3: Implement the scene and the testable transition helper**

Create 14 `THREE.Mesh` planes whose ring textures are independently drawn with original `CanvasRenderingContext2D` helpers. Draw labels, tick marks, and divider rings from `LUOPAN_LAYERS`; draw the TaiJi, Bagua, nine stars, 24 stars, three needle rings, 72/60/120 counts, 64 hexagrams, 28 mansions, 24 solar terms, and 360-degree ticks without importing any reference-project source.

Use one `THREE.Group` for all layers. In flat mode set each mesh Z to `0`; in spatial mode tween each mesh to its `spatialDepth`. Maintain one animation frame, cap renderer pixel ratio at `1.5` on compact/low-memory/reduced-motion environments, and reduce label texture resolution and particle count there. A `THREE.Ray` or additive line from the center must illuminate the selected hexagram angle after `revealHexagram`.

Implement this pure helper before WebGL-specific code:

```ts
export function sceneTransitionFor(
  state: LuopanState,
  action: { type: "cast-line"; index: number } | { type: "guide"; x: number; y: number; roll: number }
): { nextMode: LuopanMode; pulseLayer: "hexagrams" | null; lineIndex: number | null; acceptsGuide: boolean } {
  // Return a stable transition description; mutate no Three.js objects here.
}
```

`createLuopanScene` must catch renderer initialization failures and return `null`; Task 4 uses that signal to leave the CSS fallback visible.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --dir frontend test luopan-scene.test.ts`

Expected: PASS with 2 tests.

- [ ] **Step 5: Commit the Three.js scene**

```bash
git add frontend/src/luopan-scene.ts frontend/src/luopan-scene.test.ts
git commit -m "feat: render threejs luopan scene"
```

### Task 4: Route Gesture Categories to Ritual Actions

**Files:**
- Create: `frontend/src/ritual-gestures.ts`
- Create: `frontend/src/ritual-gestures.test.ts`
- Modify: `frontend/src/main.ts`

**Interfaces:**
- Consumes MediaPipe category names and the `LuopanScene` API.
- Produces `ritualActionForGesture(category, sceneMode)` and `shouldTriggerGesture(previous, next, heldMs)`.
- `main.ts` uses the helper to retain gesture latching and makes no direct gesture-name branching for ritual actions.

- [ ] **Step 1: Write the failing gesture routing tests**

```ts
import { describe, expect, it } from "vitest";
import { ritualActionForGesture, shouldTriggerGesture } from "./ritual-gestures";

describe("ritual gesture routing", () => {
  it("maps the agreed MediaPipe categories to distinct ritual actions", () => {
    expect(ritualActionForGesture("Pointing_Up", "dormant")).toEqual({ type: "awaken" });
    expect(ritualActionForGesture("Closed_Fist", "flat")).toEqual({ type: "toggle-depth" });
    expect(ritualActionForGesture("Victory", "spatial")).toEqual({ type: "cast-line" });
    expect(ritualActionForGesture("Open_Palm", "spatial")).toEqual({ type: "guide" });
  });

  it("requires a hold threshold and a gesture edge for discrete actions", () => {
    expect(shouldTriggerGesture("Victory", "Victory", 650)).toBe(false);
    expect(shouldTriggerGesture("Open_Palm", "Victory", 300)).toBe(false);
    expect(shouldTriggerGesture("Open_Palm", "Victory", 650)).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --dir frontend test ritual-gestures.test.ts`

Expected: FAIL because `./ritual-gestures` does not exist.

- [ ] **Step 3: Implement routing and integrate `main.ts`**

Keep `GestureRecognizer` and camera permissions. Replace the old `Closed_Fist` line-cast branch with a 650 ms debounced `toggleDepth` call. Route `Victory` through the existing cryptographic coin cast and increment the six-line stack exactly once per recognition edge. Route `Pointing_Up` to scene awakening plus pointer focus. While the scene is spatial, forward normalized palm center and roll to `guide`; do not create lines from `Open_Palm`.

Update all instructional strings and status names so the UI describes the agreed controls. Keep `castNextLine("manual")` intact and make it call `scene.castLine(lines.length)` after a line is generated. When `showResult` receives the backend response, call `scene.revealHexagram(result.primary.number)`; when reset runs, call `scene.reset()`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --dir frontend test ritual-gestures.test.ts`

Expected: PASS with 2 tests.

- [ ] **Step 5: Commit gesture integration**

```bash
git add frontend/src/ritual-gestures.ts frontend/src/ritual-gestures.test.ts frontend/src/main.ts
git commit -m "feat: route gestures through luopan actions"
```

### Task 5: Replace the Stage With the 3D Canvas and Preserve Fallback UX

**Files:**
- Modify: `frontend/index.html`
- Modify: `frontend/src/styles.css`
- Modify: `frontend/src/main.ts`

**Interfaces:**
- Consumes the `LuopanScene | null` returned by `createLuopanScene`.
- Produces a stage with `#luopanCanvas`, a visible CSS fallback class, and status text that can describe dormant, flat, and spatial states.
- Existing right panel and `#lineStack` remain stable DOM contracts.

- [ ] **Step 1: Write the failing DOM contract test**

Create `frontend/src/stage-contract.test.ts` with a source-level contract that reads `../index.html` through Vite's supported raw import and asserts the 3D canvas and fallback layer exist:

```ts
import { describe, expect, it } from "vitest";
import template from "../index.html?raw";

describe("ritual stage contract", () => {
  it("provides a WebGL canvas and a CSS fallback layer", () => {
    expect(template).toContain('id="luopanCanvas"');
    expect(template).toContain('id="luopanFallback"');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --dir frontend test stage-contract.test.ts`

Expected: FAIL because the current HTML has neither ID.

- [ ] **Step 3: Implement the stage and responsive style rules**

Add `<canvas id="luopanCanvas" aria-label="十四层三维罗盘"></canvas>` below the camera video and retain the current 2D orbit as `<div id="luopanFallback">`. Hide the fallback only after `createLuopanScene` succeeds; add `webgl-unavailable` to the stage and update `gestureHint` when it returns `null`.

Give the canvas a stable square rendering region, use `object-fit: cover` only for camera video, and keep the title/supporting copy outside the canvas visual center. At `max-width: 980px`, make the stage a full-width band; at `max-width: 560px`, preserve all rings but use the scene's compact texture profile and prevent copy/control overlap.

- [ ] **Step 4: Run the DOM test and full frontend suite**

Run: `pnpm --dir frontend test && pnpm --dir frontend build`

Expected: all Vitest tests PASS and `tsc --noEmit && vite build` exits 0.

- [ ] **Step 5: Commit the stage presentation**

```bash
git add frontend/index.html frontend/src/styles.css frontend/src/main.ts frontend/src/stage-contract.test.ts
git commit -m "feat: present immersive luopan stage"
```

### Task 6: Verify the Divination Workflow and Release

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes built `frontend/dist` and the existing `SHUSHU_RUNTIME_IMAGE=qunqun-study:local` server runtime.
- Produces a deployed container serving the new static bundle at `https://ritual.qunxinjia.cn`.

- [ ] **Step 1: Document the final gesture contract**

Add this exact control table to `README.md`:

```md
| 手势 | 行为 |
| --- | --- |
| 食指 | 唤醒并指向阵盘 |
| 握拳 | 在平面阵盘与 3D 阵盘之间切换 |
| 张掌 | 在 3D 状态下调整观察方向 |
| V 手势 | 生成一爻 |
```

- [ ] **Step 2: Run all local verification commands**

Run:

```bash
pnpm --dir frontend test
pnpm --dir frontend build
.venv/bin/python -m pytest -q backend/tests
git diff --check
```

Expected: all tests pass, build passes, and `git diff --check` has no output.

- [ ] **Step 3: Perform browser checks**

Start the local frontend and verify at desktop and mobile viewports:

```bash
pnpm --dir frontend dev --host 127.0.0.1
```

Confirm that the canvas is nonblank, the 14-layer ring is framed without text overlap, manual line generation pulses the hexagram ring, and a six-line response highlights one primary hexagram sector. Confirm that the fallback appears when WebGL initialization is deliberately disabled in a local test build.

- [ ] **Step 4: Commit and push the integrated feature**

```bash
git add README.md frontend
git commit -m "feat: add immersive threejs luopan"
git push origin master
```

- [ ] **Step 5: Deploy with the existing offline Docker service**

Build `frontend/dist`, package the pushed commit plus `frontend/dist`, upload it to the server, then run:

```bash
SHUSHU_RUNTIME_IMAGE=qunqun-study:local \
docker compose -f /opt/shushu-gesture-ritual/repo/docker-compose.offline.yml \
  up -d --no-build --force-recreate
```

Do not run `docker compose down -v`, do not delete volumes, and do not modify the study-site container.

- [ ] **Step 6: Verify the live deployment**

Run:

```bash
curl -fsS https://ritual.qunxinjia.cn/health
curl -fsS https://ritual.qunxinjia.cn/ | grep -q 'luopanCanvas'
docker ps --filter name=shushu-gesture-ritual
```

Expected: health JSON identifies `shushu-gesture-ritual`, the HTML contains `luopanCanvas`, and the ritual container is healthy on `127.0.0.1:5174`.
