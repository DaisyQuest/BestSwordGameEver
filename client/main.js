import { createDemoSession } from "../shared/demo/demoSession.js";

const canvas = document.querySelector("#arena");
const ctx = canvas.getContext("2d");

const staminaFill = document.querySelector("#stamina-fill");
const staminaValue = document.querySelector("#stamina-value");
const postureEl = document.querySelector("#posture");
const speedEl = document.querySelector("#speed");
const intentEl = document.querySelector("#intent");
const resetButton = document.querySelector("#reset");

const session = createDemoSession({
  balance: { impactThreshold: 0 },
  stamina: { max: 100, regenRate: 12, sprintCost: 24, exhaustionThreshold: 0.2 },
  physics: { gravity: { x: 0, y: 0 }, maxSpeed: 16 }
});

const inputState = new Set();
let lastTime = null;
let state = session.getSnapshot();

const resizeCanvas = () => {
  const { width, height } = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
};

const handleKey = (event, active) => {
  if (active) {
    inputState.add(event.code);
  } else {
    inputState.delete(event.code);
  }
  if (event.code === "KeyR" && active) {
    state = session.reset();
  }
};

window.addEventListener("keydown", (event) => handleKey(event, true));
window.addEventListener("keyup", (event) => handleKey(event, false));
window.addEventListener("resize", resizeCanvas);
resetButton.addEventListener("click", () => {
  state = session.reset();
});

const buildInputs = () =>
  Array.from(inputState).map((code) => ({
    code,
    active: true
  }));

const wantsSprint = () => inputState.has("ShiftLeft") || inputState.has("ShiftRight");

const updateHud = (frame) => {
  const stamina = frame.player.model.stamina;
  const ratio = stamina.max > 0 ? stamina.current / stamina.max : 0;
  staminaFill.style.width = `${Math.round(ratio * 100)}%`;
  staminaFill.style.background = stamina.exhausted
    ? "linear-gradient(90deg, #ff8f7a, #ffb38a)"
    : "linear-gradient(90deg, #7bf2c3 0%, #4ee6ff 100%)";
  staminaValue.textContent = `${Math.round(stamina.current)} / ${stamina.max}`;

  postureEl.textContent = frame.player.model.posture;
  speedEl.textContent = frame.speed.toFixed(1);
  intentEl.textContent = `${frame.intent.move.x.toFixed(1)}, ${frame.intent.move.y.toFixed(1)}`;
};

const drawGrid = (center, scale, radius) => {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
  ctx.lineWidth = 1;
  const spacing = scale;
  for (let x = center.x - radius * scale; x <= center.x + radius * scale; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, center.y - radius * scale);
    ctx.lineTo(x, center.y + radius * scale);
    ctx.stroke();
  }
  for (let y = center.y - radius * scale; y <= center.y + radius * scale; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(center.x - radius * scale, y);
    ctx.lineTo(center.x + radius * scale, y);
    ctx.stroke();
  }
  ctx.restore();
};

const drawActor = (center, scale, actor, color) => {
  const position = {
    x: center.x + actor.body.position.x * scale,
    y: center.y - actor.body.position.y * scale
  };
  ctx.save();
  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.arc(position.x, position.y, 14, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(position.x, position.y);
  ctx.lineTo(position.x + 22, position.y - 12);
  ctx.stroke();
  ctx.restore();
};

const render = (frame) => {
  const { width, height } = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, width, height);

  const center = { x: width / 2, y: height / 2 };
  const radius = frame.arenaRadius;
  const scale = Math.min(width, height) / (radius * 2.4);

  ctx.fillStyle = "rgba(8, 10, 18, 0.85)";
  ctx.fillRect(0, 0, width, height);

  drawGrid(center, scale, radius);

  ctx.save();
  ctx.strokeStyle = "rgba(123, 242, 195, 0.45)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(center.x, center.y, radius * scale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  drawActor(center, scale, frame.rival, "rgba(255, 143, 122, 0.9)");
  drawActor(center, scale, frame.player, "rgba(123, 242, 195, 0.95)");
};

const loop = (timestamp) => {
  if (!Number.isFinite(timestamp)) {
    requestAnimationFrame(loop);
    return;
  }
  if (lastTime === null) {
    lastTime = timestamp;
    requestAnimationFrame(loop);
    return;
  }
  const rawDelta = timestamp - lastTime;
  if (!Number.isFinite(rawDelta) || rawDelta <= 0) {
    lastTime = timestamp;
    requestAnimationFrame(loop);
    return;
  }
  const deltaMs = Math.min(100, rawDelta);
  lastTime = timestamp;

  state = session.step(deltaMs, buildInputs(), { sprint: wantsSprint() });
  const speed = Math.hypot(state.player.body.velocity.x, state.player.body.velocity.y);
  updateHud({ ...state, speed });
  render(state);

  requestAnimationFrame(loop);
};

resizeCanvas();
requestAnimationFrame(loop);
