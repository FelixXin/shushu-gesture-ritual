import {
  DrawingUtils,
  FilesetResolver,
  GestureRecognizer,
  type GestureRecognizerResult
} from "@mediapipe/tasks-vision";

import { createHexagramSectors, findHexagramSector } from "./compass";
import { castCoinLine, linePresentation, type LineValue } from "./hexagrams";
import { createLuopanScene } from "./luopan-scene";
import { ritualActionForGesture } from "./ritual-gestures";

type HexagramSummary = {
  number: number;
  name: string;
  upper: string;
  lower: string;
};

type HexagramResponse = {
  lines: LineValue[];
  moving_lines: number[];
  primary: HexagramSummary;
  changed: HexagramSummary;
};

const WASM_ROOT = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-tasks/gesture_recognizer/gesture_recognizer.task";
const INFERENCE_INTERVAL_MS = 90;
const FIST_HOLD_MS = 650;

const element = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
};

const video = element<HTMLVideoElement>("cameraVideo");
const ambientCanvas = element<HTMLCanvasElement>("ambientCanvas");
const luopanCanvas = element<HTMLCanvasElement>("luopanCanvas");
const ambientContext = ambientCanvas.getContext("2d");
const overlay = element<HTMLCanvasElement>("handOverlay");
const overlayContext = overlay.getContext("2d");
const ritualStage = element<HTMLElement>("ritualStage");
const ritualOrbit = element<HTMLDivElement>("ritualOrbit");
const gestureProgress = element<HTMLElement>("gestureProgress");
const castFlash = element<HTMLDivElement>("castFlash");
const cameraButton = element<HTMLButtonElement>("cameraButton");
const castButton = element<HTMLButtonElement>("castButton");
const resetButton = element<HTMLButtonElement>("resetButton");

type AmbientParticle = {
  x: number;
  y: number;
  radius: number;
  speed: number;
  alpha: number;
  phase: number;
};

let recognizer: GestureRecognizer | null = null;
let stream: MediaStream | null = null;
let animationFrame = 0;
let lastInferenceAt = 0;
let activeGesture = "None";
let gestureStartedAt = 0;
let fistLatched = false;
let lines: LineValue[] = [];
let ambientParticles: AmbientParticle[] = [];
let ambientFrame = 0;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const luopanScene = createLuopanScene(luopanCanvas);
if (luopanScene) ritualStage.classList.add("webgl-ready");

function buildHexagramRing(): void {
  const ring = element<HTMLDivElement>("hexagramRing");
  const fragment = document.createDocumentFragment();
  createHexagramSectors().forEach((sector) => {
    const label = document.createElement("span");
    label.className = "hexagram-sector";
    label.dataset.number = String(sector.number);
    label.style.setProperty("--angle", `${sector.angle}deg`);

    const number = document.createElement("b");
    number.textContent = String(sector.number);
    const name = document.createElement("span");
    name.textContent = sector.name;
    label.append(number, name);
    fragment.append(label);
  });
  ring.replaceChildren(fragment);
}

function renderLineStack(): void {
  const stack = element<HTMLDivElement>("lineStack");
  const fragment = document.createDocumentFragment();

  for (let position = 6; position >= 1; position -= 1) {
    const value = lines[position - 1];
    const row = document.createElement("div");
    row.className = "line-row";
    if (value && position === lines.length) row.classList.add("newly-cast");
    row.setAttribute("aria-label", `第 ${position} 爻${value ? `，数值 ${value}` : "，未生成"}`);

    const label = document.createElement("span");
    label.className = "line-position";
    label.textContent = `${position}`;

    const visual = document.createElement("span");
    visual.className = "line-visual";
    if (value) {
      const presentation = linePresentation(value);
      visual.classList.add(presentation.kind);
      if (presentation.moving) visual.classList.add("moving");
      visual.innerHTML = presentation.kind === "yang"
        ? '<i class="solid-line"></i>'
        : '<i class="broken-line"></i><i class="broken-line"></i>';
    } else {
      visual.classList.add("empty-line");
    }

    const valueLabel = document.createElement("strong");
    valueLabel.textContent = value ? String(value) : "—";
    row.append(label, visual, valueLabel);
    fragment.append(row);
  }

  stack.replaceChildren(fragment);
  element("lineCount").textContent = String(lines.length);
  ritualOrbit.dataset.castStep = String(lines.length);
  ritualOrbit.style.setProperty("--cast-progress", `${lines.length * 60}deg`);
  document.querySelectorAll<HTMLElement>("#ritualProgress i").forEach((dot, index) => {
    dot.classList.toggle("active", index < lines.length);
    dot.classList.toggle("next", index === lines.length);
  });
  castButton.disabled = lines.length >= 6;
}

function secureRandomByte(): number {
  const value = new Uint8Array(1);
  crypto.getRandomValues(value);
  return value[0];
}

async function castNextLine(source: "gesture" | "manual"): Promise<void> {
  if (lines.length >= 6) return;
  lines.push(castCoinLine(secureRandomByte()));
  luopanScene?.castLine(lines.length);
  emitCastBurst(source);
  renderLineStack();
  ritualOrbit.classList.remove("casting");
  requestAnimationFrame(() => ritualOrbit.classList.add("casting"));
  element("gestureHint").textContent = source === "gesture"
    ? `第 ${lines.length} 爻已由握拳确认。${lines.length < 6 ? "张掌后再次握拳，继续成爻。" : "六爻已成，正在定卦。"}`
    : `第 ${lines.length} 爻已生成。${lines.length < 6 ? "可继续使用手势或按钮。" : "六爻已成，正在定卦。"}`;

  if (lines.length === 6) await resolveResult();
}

async function resolveResult(): Promise<void> {
  try {
    const response = await fetch("/api/v1/hexagrams/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines })
    });
    if (!response.ok) throw new Error(`解析服务返回 ${response.status}`);
    const result = await response.json() as HexagramResponse;
    showResult(result);
  } catch (error) {
    element("gestureHint").textContent = `六爻已生成，但解析服务不可用：${error instanceof Error ? error.message : "未知错误"}`;
  }
}

function showResult(result: HexagramResponse): void {
  element("emptyResult").setAttribute("hidden", "");
  element("resultCard").removeAttribute("hidden");
  element("primaryHexagram").textContent = `${result.primary.number} · ${result.primary.name}`;
  element("changedHexagram").textContent = `${result.changed.number} · ${result.changed.name}`;
  element("primaryTrigrams").textContent = `${result.primary.upper}上 ${result.primary.lower}下`;
  element("changedTrigrams").textContent = `${result.changed.upper}上 ${result.changed.lower}下`;
  element("movingLines").textContent = result.moving_lines.length
    ? `动爻：${result.moving_lines.join("、")}`
    : "无动爻";

  document.querySelectorAll(".hexagram-sector.active").forEach((node) => node.classList.remove("active"));
  const sector = findHexagramSector(result.primary.number);
  if (sector) {
    ritualOrbit.style.setProperty("--result-angle", `${sector.angle}deg`);
    ritualOrbit.style.setProperty("--result-spin", `-${sector.angle}deg`);
    ritualOrbit.style.setProperty("--result-overshoot", `-${sector.angle * 1.08}deg`);
    document.querySelector(`.hexagram-sector[data-number="${sector.number}"]`)?.classList.add("active");
  }
  ritualOrbit.classList.add("revealed");
  luopanScene?.revealHexagram(result.primary.number);
  ritualStage.classList.add("result-revealed");
  emitResultWave();
  element("gestureHint").textContent = `${result.primary.name}卦已显。可重置后再次起卦。`;
}

function resetRitual(): void {
  lines = [];
  fistLatched = false;
  ritualOrbit.classList.remove("casting", "revealed");
  delete ritualOrbit.dataset.castStep;
  ritualOrbit.style.removeProperty("--cast-progress");
  ritualOrbit.style.removeProperty("--result-angle");
  ritualOrbit.style.removeProperty("--result-spin");
  ritualOrbit.style.removeProperty("--result-overshoot");
  ritualStage.classList.remove("result-revealed");
  luopanScene?.reset();
  document.querySelectorAll(".hexagram-sector.active").forEach((node) => node.classList.remove("active"));
  element("resultCard").setAttribute("hidden", "");
  element("emptyResult").removeAttribute("hidden");
  element("gestureHint").textContent = stream
    ? "张开手掌唤醒圆盘，再以握拳依次生成六爻。"
    : "开启摄像头后，张开手掌唤醒圆盘，再以握拳依次生成六爻。";
  renderLineStack();
}

async function initRecognizer(): Promise<void> {
  if (recognizer) return;
  element("gestureHint").textContent = "正在加载手势识别模型…";
  const vision = await FilesetResolver.forVisionTasks(WASM_ROOT);
  recognizer = await GestureRecognizer.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_URL },
    runningMode: "VIDEO",
    numHands: 1,
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.6,
    minTrackingConfidence: 0.6,
    cannedGesturesClassifierOptions: { scoreThreshold: 0.65 }
  });
}

async function startCamera(): Promise<void> {
  if (stream) {
    stopCamera();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    element("gestureHint").textContent = "当前页面无法调用摄像头，请使用 HTTPS 或 localhost 打开。";
    return;
  }

  cameraButton.disabled = true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    video.srcObject = stream;
    await video.play();
    await initRecognizer();
    cameraButton.textContent = "关闭摄像头";
    ritualStage.classList.add("camera-live");
    ritualOrbit.classList.add("awakened");
    element("gestureHint").textContent = "摄像头已开启。张掌唤醒，握拳保持约一秒生成一爻。";
    animationFrame = requestAnimationFrame(recognitionLoop);
  } catch (error) {
    stopCamera();
    element("gestureHint").textContent = `无法开启摄像头：${error instanceof Error ? error.message : "请检查权限"}`;
  } finally {
    cameraButton.disabled = false;
  }
}

function stopCamera(): void {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
  cameraButton.textContent = "开启摄像头";
  ritualOrbit.classList.remove("awakened");
  ritualStage.classList.remove("camera-live");
  setGestureVisual("None", 0);
  element("gestureName").textContent = "等待手势";
  element("gestureScore").textContent = "—";
  if (overlayContext) overlayContext.clearRect(0, 0, overlay.width, overlay.height);
}

function recognitionLoop(now: number): void {
  if (!stream || !recognizer) return;
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && now - lastInferenceAt >= INFERENCE_INTERVAL_MS) {
    lastInferenceAt = now;
    const result = recognizer.recognizeForVideo(video, now);
    drawHand(result);
    handleGesture(result, now);
  }
  animationFrame = requestAnimationFrame(recognitionLoop);
}

function drawHand(result: GestureRecognizerResult): void {
  if (!overlayContext || !video.videoWidth || !video.videoHeight) return;
  if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
  }
  overlayContext.clearRect(0, 0, overlay.width, overlay.height);
  const drawing = new DrawingUtils(overlayContext);
  result.landmarks.forEach((landmarks) => {
    drawing.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, {
      color: "rgba(230, 198, 119, .75)",
      lineWidth: 2
    });
    drawing.drawLandmarks(landmarks, {
      color: "#f3e4b6",
      fillColor: "#10100e",
      radius: 3,
      lineWidth: 1
    });
  });
}

function handleGesture(result: GestureRecognizerResult, now: number): void {
  const category = result.gestures[0]?.[0];
  const name = category?.categoryName ?? "None";
  const score = category?.score ?? 0;
  element("gestureName").textContent = gestureLabel(name);
  element("gestureScore").textContent = score ? `${Math.round(score * 100)}%` : "—";

  const gestureChanged = name !== activeGesture;
  if (gestureChanged) {
    activeGesture = name;
    gestureStartedAt = now;
    announceGestureEntrance(name);
  }

  const holdProgress = name === "Closed_Fist"
    ? Math.min(1, Math.max(0, (now - gestureStartedAt) / FIST_HOLD_MS))
    : score;
  setGestureVisual(name, holdProgress);

  const action = ritualActionForGesture(name, luopanScene?.getState().mode ?? "dormant");
  if (action === "awaken") luopanScene?.awaken();
  if (name === "Open_Palm") {
    fistLatched = false;
    ritualOrbit.classList.add("awakened");
  }

  if (name === "Pointing_Up") {
    const indexTip = result.landmarks[0]?.[8];
    if (indexTip) {
      ritualOrbit.style.setProperty("--hand-rotation", `${(0.5 - indexTip.x) * 86}deg`);
      ritualOrbit.style.setProperty("--gesture-x", `${indexTip.x * 100}%`);
      ritualOrbit.style.setProperty("--gesture-y", `${indexTip.y * 100}%`);
      luopanScene?.guide({ x: indexTip.x, y: indexTip.y, roll: 0 });
    }
  }

  if (name === "Closed_Fist" && !fistLatched && now - gestureStartedAt >= FIST_HOLD_MS) {
    fistLatched = true;
    if ((luopanScene?.getState().mode ?? "dormant") === "dormant") luopanScene?.awaken();
    else luopanScene?.toggleDepth();
  }
  if (name === "Victory" && !fistLatched && now - gestureStartedAt >= FIST_HOLD_MS) {
    fistLatched = true;
    void castNextLine("gesture");
  }
}

function setGestureVisual(name: string, progress: number): void {
  const state = name === "Open_Palm"
    ? "open"
    : name === "Closed_Fist"
      ? "fist"
      : name === "Pointing_Up"
        ? "point"
        : name === "Victory"
          ? "seal"
          : name === "Thumb_Up"
            ? "rise"
            : name === "Thumb_Down"
              ? "wane"
              : name === "ILoveYou"
                ? "invoke"
        : "idle";
  ritualStage.dataset.gesture = state;
  ritualOrbit.style.setProperty("--charge", String(Math.min(1, Math.max(0, progress))));
  gestureProgress.style.transform = `scaleX(${Math.min(1, Math.max(0, progress))})`;
}

function announceGestureEntrance(name: string): void {
  const hint = {
    Open_Palm: "掌门已启，阵盘正在苏醒。握拳蓄力即可成爻。",
    Pointing_Up: "指引星轨：移动食指可牵引阵盘方向。",
    Closed_Fist: "气聚于掌，保持握拳直至蓄力完成。",
    Victory: "双指结印：六十四卦与八卦环进入共振。",
    Thumb_Up: "阳气上升：阵心光柱已经点亮。",
    Thumb_Down: "阴气下沉：阵盘进入收势状态。",
    ILoveYou: "三才相应：星芒阵纹已经展开。"
  }[name];
  if (!hint) return;
  element("gestureHint").textContent = hint;
  ritualOrbit.classList.remove("gesture-flare");
  void ritualOrbit.offsetWidth;
  ritualOrbit.classList.add("gesture-flare");
  window.setTimeout(() => ritualOrbit.classList.remove("gesture-flare"), 900);
}

function emitCastBurst(source: "gesture" | "manual"): void {
  castFlash.classList.remove("active");
  void castFlash.offsetWidth;
  castFlash.classList.add("active");

  const burst = document.createElement("div");
  burst.className = "cast-burst";
  for (let index = 0; index < 24; index += 1) {
    const spark = document.createElement("i");
    spark.style.setProperty("--spark-angle", `${index * 15 + Math.random() * 8}deg`);
    spark.style.setProperty("--spark-distance", `${110 + Math.random() * 190}px`);
    spark.style.setProperty("--spark-delay", `${Math.random() * 90}ms`);
    burst.append(spark);
  }
  ritualStage.append(burst);
  window.setTimeout(() => burst.remove(), 1200);
  if ("vibrate" in navigator) navigator.vibrate(source === "gesture" ? [24, 18, 42] : 28);
}

function emitResultWave(): void {
  const wave = document.createElement("div");
  wave.className = "result-wave";
  ritualStage.append(wave);
  window.setTimeout(() => wave.remove(), 1800);
}

function resizeAmbientCanvas(): void {
  if (!ambientContext) return;
  const bounds = ritualStage.getBoundingClientRect();
  const scale = Math.min(window.devicePixelRatio || 1, 2);
  ambientCanvas.width = Math.max(1, Math.floor(bounds.width * scale));
  ambientCanvas.height = Math.max(1, Math.floor(bounds.height * scale));
  ambientCanvas.style.width = `${bounds.width}px`;
  ambientCanvas.style.height = `${bounds.height}px`;
  ambientContext.setTransform(scale, 0, 0, scale, 0, 0);
  const particleCount = reducedMotion ? 34 : Math.min(120, Math.floor(bounds.width / 8));
  ambientParticles = Array.from({ length: particleCount }, () => ({
    x: Math.random() * bounds.width,
    y: Math.random() * bounds.height,
    radius: 0.35 + Math.random() * 1.45,
    speed: 0.035 + Math.random() * 0.13,
    alpha: 0.18 + Math.random() * 0.58,
    phase: Math.random() * Math.PI * 2
  }));
}

function drawAmbient(now = 0): void {
  if (!ambientContext) return;
  const width = ritualStage.clientWidth;
  const height = ritualStage.clientHeight;
  ambientContext.clearRect(0, 0, width, height);

  for (const particle of ambientParticles) {
    if (!reducedMotion) {
      particle.y -= particle.speed;
      particle.x += Math.sin(now * 0.00025 + particle.phase) * 0.045;
      if (particle.y < -8) {
        particle.y = height + 8;
        particle.x = Math.random() * width;
      }
    }
    const shimmer = 0.56 + Math.sin(now * 0.0015 + particle.phase) * 0.44;
    ambientContext.beginPath();
    ambientContext.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ambientContext.fillStyle = `rgba(244, 218, 146, ${particle.alpha * shimmer})`;
    ambientContext.shadowColor = "rgba(229, 190, 92, .85)";
    ambientContext.shadowBlur = particle.radius * 5;
    ambientContext.fill();
  }
  ambientContext.shadowBlur = 0;
  if (!reducedMotion) ambientFrame = requestAnimationFrame(drawAmbient);
}

function updatePointerParallax(event: PointerEvent): void {
  const bounds = ritualStage.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width - 0.5;
  const y = (event.clientY - bounds.top) / bounds.height - 0.5;
  ritualOrbit.style.setProperty("--tilt-x", `${x * 7}deg`);
  ritualOrbit.style.setProperty("--tilt-y", `${y * -7}deg`);
  ritualStage.style.setProperty("--pointer-x", `${(x + 0.5) * 100}%`);
  ritualStage.style.setProperty("--pointer-y", `${(y + 0.5) * 100}%`);
}

function gestureLabel(name: string): string {
  return {
    Open_Palm: "张开手掌",
    Closed_Fist: "握拳蓄势",
    Pointing_Up: "食指引盘",
    Victory: "胜利手势",
    Thumb_Up: "拇指向上",
    Thumb_Down: "拇指向下",
    ILoveYou: "手势已识别",
    None: "等待手势"
  }[name] ?? name;
}

async function checkService(): Promise<void> {
  const dot = element("serviceDot");
  try {
    const response = await fetch("/health");
    if (!response.ok) throw new Error();
    dot.classList.add("online");
    element("serviceStatus").textContent = "解析服务已连接";
  } catch {
    dot.classList.add("offline");
    element("serviceStatus").textContent = "解析服务未启动";
  }
}

cameraButton.addEventListener("click", () => void startCamera());
castButton.addEventListener("click", () => void castNextLine("manual"));
resetButton.addEventListener("click", resetRitual);
ritualStage.addEventListener("pointermove", updatePointerParallax);
ritualStage.addEventListener("pointerleave", () => {
  ritualOrbit.style.setProperty("--tilt-x", "0deg");
  ritualOrbit.style.setProperty("--tilt-y", "0deg");
});
window.addEventListener("resize", resizeAmbientCanvas);
window.addEventListener("beforeunload", () => {
  stopCamera();
  luopanScene?.dispose();
  if (ambientFrame) cancelAnimationFrame(ambientFrame);
});

buildHexagramRing();
renderLineStack();
resizeAmbientCanvas();
drawAmbient();
void checkService();
