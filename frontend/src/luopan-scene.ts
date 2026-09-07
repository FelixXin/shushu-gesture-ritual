import * as THREE from "three";
import { LUOPAN_LAYERS, type LuopanLayer } from "./luopan-data";
import { initialLuopanState, reduceLuopanState, type LuopanState } from "./luopan-state";

type SceneAction = { type: "cast-line"; index: number } | { type: "guide"; x: number; y: number; roll: number };
type SceneTransition = { nextMode: LuopanState["mode"]; pulseLayer: "hexagrams" | null; lineIndex: number | null; acceptsGuide: boolean };

export function sceneTransitionFor(state: LuopanState, action: SceneAction): SceneTransition {
  return action.type === "cast-line"
    ? { nextMode: state.mode, pulseLayer: "hexagrams", lineIndex: action.index, acceptsGuide: false }
    : { nextMode: state.mode, pulseLayer: null, lineIndex: null, acceptsGuide: state.mode === "spatial" };
}

export type LuopanScene = {
  awaken(): void;
  toggleDepth(): void;
  guide(input: { x: number; y: number; roll: number }): void;
  castLine(index: number): void;
  revealHexagram(number: number): void;
  reset(): void;
  resize(): void;
  dispose(): void;
  getState(): LuopanState;
};

type LayerMesh = { definition: LuopanLayer; mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> };

const GOLD = new THREE.Color(0xe0bd6b);
const JADE = new THREE.Color(0x71c8b5);

function drawRingTexture(layer: LuopanLayer, compact: boolean): THREE.CanvasTexture {
  const size = compact ? 512 : 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering is unavailable");
  const center = size / 2;
  const outer = size * 0.485;
  const inner = layer.id === "taiji" ? 0 : outer * (layer.innerRadius / layer.outerRadius);
  const radius = (inner + outer) / 2;
  context.clearRect(0, 0, size, size);
  context.strokeStyle = "rgba(232, 202, 123, .54)";
  context.lineWidth = Math.max(1, size / 540);
  context.beginPath(); context.arc(center, center, outer, 0, Math.PI * 2); context.stroke();
  if (inner) { context.beginPath(); context.arc(center, center, inner, 0, Math.PI * 2); context.stroke(); }
  const count = layer.tokenCount;
  const textEvery = compact && count > 64 ? Math.ceil(count / 36) : compact && count > 24 ? 2 : 1;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `${Math.max(11, (outer - inner || outer) * (count > 120 ? 0.12 : count > 64 ? 0.18 : count > 24 ? 0.25 : 0.34))}px "Songti SC", "STSong", serif`;
  layer.tokens.forEach((token, index) => {
    const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
    const tick = index % Math.max(1, Math.round(count / 24)) === 0 ? 14 : 7;
    context.strokeStyle = index % Math.max(1, Math.round(count / 24)) === 0 ? "rgba(242, 221, 160, .8)" : "rgba(214, 179, 101, .38)";
    context.beginPath();
    context.moveTo(center + Math.cos(angle) * outer, center + Math.sin(angle) * outer);
    context.lineTo(center + Math.cos(angle) * (outer - tick), center + Math.sin(angle) * (outer - tick));
    context.stroke();
    if (index % textEvery !== 0 || (layer.id === "heavenly-degrees" && compact)) return;
    context.save();
    context.translate(center + Math.cos(angle) * radius, center + Math.sin(angle) * radius);
    context.rotate(angle + Math.PI / 2);
    context.fillStyle = layer.id === "hexagrams" ? "rgba(249, 230, 177, .95)" : "rgba(229, 218, 187, .7)";
    context.fillText(token, 0, 0);
    context.restore();
  });
  if (layer.id === "taiji") {
    context.fillStyle = "#e8dcc0";
    context.beginPath(); context.arc(center, center, outer * .64, -Math.PI / 2, Math.PI / 2); context.arc(center, center + outer * .32, outer * .32, Math.PI / 2, -Math.PI / 2, true); context.arc(center, center - outer * .32, outer * .32, Math.PI / 2, -Math.PI / 2, true); context.fill();
    context.fillStyle = "#090a07";
    context.beginPath(); context.arc(center, center - outer * .32, outer * .32, 0, Math.PI * 2); context.fill();
    context.beginPath(); context.arc(center, center + outer * .32, outer * .08, 0, Math.PI * 2); context.fill();
    context.fillStyle = "#e8dcc0"; context.beginPath(); context.arc(center, center - outer * .32, outer * .08, 0, Math.PI * 2); context.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  return texture;
}

export function createLuopanScene(canvas: HTMLCanvasElement): LuopanScene | null {
  try {
    const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
    const compact = window.matchMedia("(max-width: 720px), (prefers-reduced-motion: reduce)").matches || deviceMemory <= 4;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, .1, 30);
    camera.position.set(0, .15, 7.8);
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: !compact, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, compact ? 1 : 1.5));
    const field = new THREE.Group();
    scene.add(field);
    const meshes: LayerMesh[] = LUOPAN_LAYERS.map((definition) => {
      const texture = drawRingTexture(definition, compact);
      const geometry = new THREE.PlaneGeometry(definition.outerRadius * 2, definition.outerRadius * 2);
      const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: .88, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometry, material);
      field.add(mesh);
      return { definition, mesh };
    });
    const rayGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 3.25, .1)]);
    const ray = new THREE.Line(rayGeometry, new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0 }));
    field.add(ray);
    const stars = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: JADE, size: .018, transparent: true, opacity: .5 }));
    scene.add(stars);
    let state = initialLuopanState;
    let frame = 0;
    let pulse = 0;
    let targetRotation = new THREE.Vector2(0, 0);

    const applyState = () => {
      meshes.forEach(({ definition, mesh }, index) => {
        mesh.position.z = state.mode === "spatial" ? definition.spatialDepth : 0;
        mesh.material.opacity = state.mode === "dormant" ? .18 : .82 + (index % 2 ? .04 : 0);
      });
      if (state.highlightedAngle !== null) {
        ray.rotation.z = THREE.MathUtils.degToRad(-state.highlightedAngle);
        (ray.material as THREE.LineBasicMaterial).opacity = .92;
      } else (ray.material as THREE.LineBasicMaterial).opacity = 0;
    };
    const render = () => {
      field.rotation.x += (targetRotation.y - field.rotation.x) * .06;
      field.rotation.y += (targetRotation.x - field.rotation.y) * .06;
      meshes.forEach(({ definition, mesh }, index) => {
        mesh.rotation.z += (index % 2 ? -1 : 1) * .00018 * (definition.tokenCount > 100 ? .5 : 1);
        if (pulse > 0 && definition.id === "hexagrams") mesh.material.opacity = Math.min(1, .82 + pulse * .18);
      });
      pulse = Math.max(0, pulse - .025);
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    const api: LuopanScene = {
      awaken: () => { state = reduceLuopanState(state, { type: "awaken" }); applyState(); },
      toggleDepth: () => { state = reduceLuopanState(state, { type: "toggle-depth" }); applyState(); },
      guide: ({ x, y, roll }) => { if (state.mode === "spatial") targetRotation.set((x - .5) * 1.1 + roll * .18, (y - .5) * -.72); },
      castLine: () => { pulse = 1; },
      revealHexagram: (number) => { state = reduceLuopanState(state, { type: "reveal", hexagramNumber: number }); applyState(); },
      reset: () => { state = reduceLuopanState(state, { type: "reset" }); targetRotation.set(0, 0); applyState(); },
      resize: () => { const { width, height } = canvas.getBoundingClientRect(); if (!width || !height) return; camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height, false); },
      dispose: () => { cancelAnimationFrame(frame); meshes.forEach(({ mesh }) => { mesh.geometry.dispose(); mesh.material.map?.dispose(); mesh.material.dispose(); }); rayGeometry.dispose(); (ray.material as THREE.Material).dispose(); renderer.dispose(); },
      getState: () => state
    };
    api.resize(); applyState(); render();
    return api;
  } catch { return null; }
}
