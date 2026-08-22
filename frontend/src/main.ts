import {
  DrawingUtils,
  FilesetResolver,
  GestureRecognizer,
  type GestureRecognizerResult
} from "@mediapipe/tasks-vision";

import { castCoinLine, HEXAGRAM_NAMES, linePresentation, type LineValue } from "./hexagrams";

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
const overlay = element<HTMLCanvasElement>("handOverlay");
const overlayContext = overlay.getContext("2d");
const ritualOrbit = element<HTMLDivElement>("ritualOrbit");
const cameraButton = element<HTMLButtonElement>("cameraButton");
const castButton = element<HTMLButtonElement>("castButton");
const resetButton = element<HTMLButtonElement>("resetButton");

let recognizer: GestureRecognizer | null = null;
let stream: MediaStream | null = null;
let animationFrame = 0;
let lastInferenceAt = 0;
let activeGesture = "None";
let gestureStartedAt = 0;
let fistLatched = false;
let lines: LineValue[] = [];

function buildHexagramRing(): void {
  const ring = element<HTMLDivElement>("hexagramRing");
  const fragment = document.createDocumentFragment();
  HEXAGRAM_NAMES.forEach((name, index) => {
    const label = document.createElement("span");
    label.className = "hexagram-label";
    label.dataset.number = String(index + 1);
    label.style.setProperty("--angle", `${index * 5.625}deg`);
    label.textContent = `${index + 1}·${name}`;
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

  document.querySelectorAll(".hexagram-label.active").forEach((node) => node.classList.remove("active"));
  document.querySelector(`.hexagram-label[data-number="${result.primary.number}"]`)?.classList.add("active");
  ritualOrbit.classList.add("revealed");
  element("gestureHint").textContent = `${result.primary.name}卦已显。可重置后再次起卦。`;
}

function resetRitual(): void {
  lines = [];
  fistLatched = false;
  ritualOrbit.classList.remove("casting", "revealed");
  document.querySelectorAll(".hexagram-label.active").forEach((node) => node.classList.remove("active"));
  element("resultCard").setAttribute("hidden", "");
  element("emptyResult").removeAttribute("hidden");
  element("gestureHint").textContent = stream
    ? "张开手掌唤醒圆盘，再以握拳依次生成六爻。"
    : "开启摄像头后，张开手掌唤醒圆盘，再以握拳依次生成六爻。";
  renderLineStack();
}

async function initRecognizer(): Promise<void> {
  if (recognizer) return;
  element("gestureHint").textContent = "正在加载本地手势识别模型…";
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

  if (name !== activeGesture) {
    activeGesture = name;
    gestureStartedAt = now;
  }

  if (name === "Open_Palm") {
    fistLatched = false;
    ritualOrbit.classList.add("awakened");
  }

  if (name === "Pointing_Up") {
    const indexTip = result.landmarks[0]?.[8];
    if (indexTip) ritualOrbit.style.setProperty("--hand-rotation", `${(0.5 - indexTip.x) * 70}deg`);
  }

  if (name === "Closed_Fist" && !fistLatched && now - gestureStartedAt >= FIST_HOLD_MS) {
    fistLatched = true;
    void castNextLine("gesture");
  }
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
window.addEventListener("beforeunload", stopCamera);

buildHexagramRing();
renderLineStack();
void checkService();
