import { createDemoSession } from "../shared/demo/demoSession.js";

const canvas = document.querySelector("#arena");
const ctx = canvas.getContext("2d");

const staminaFill = document.querySelector("#stamina-fill");
const staminaValue = document.querySelector("#stamina-value");
const postureEl = document.querySelector("#posture");
const speedEl = document.querySelector("#speed");
const intentEl = document.querySelector("#intent");
const motionEl = document.querySelector("#motion");
const resetButton = document.querySelector("#reset");

const session = createDemoSession({
  balance: { impactThreshold: 0 },
  stamina: { max: 100, regenRate: 12, sprintCost: 24, exhaustionThreshold: 0.2 },
  physics: { gravity: { x: 0, y: 0 }, maxSpeed: 16 }
});

const inputState = new Set();
let lastTime = null;
let state = session.getSnapshot();
let reducedMotion = false;

const resizeCanvas = () => {
  const { width, height } = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
};

const handleKey = (event, active) => {
  if (event.code === "KeyM") {
    if (active) {
      reducedMotion = !reducedMotion;
    }
    return;
  }
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
  motionEl.textContent = reducedMotion ? "Reduced" : "Full";
};

const computeCameraFocus = (frame) => ({
  x: (frame.player.body.position.x + frame.rival.body.position.x) / 2,
  y: (frame.player.body.position.y + frame.rival.body.position.y) / 2
});

const computeViewportCenter = (width, height) => ({
  x: width / 2,
  y: height * 0.58
});

const computeViewportScale = (width, height, radius) => Math.min(width, height) / (radius * 2);

const projectPoint = (point, center, scale, focus) => {
  const relativeX = point.x - focus.x;
  const relativeY = point.y - focus.y;
  const isoX = (relativeX - relativeY) * 0.7;
  const isoY = (relativeX + relativeY) * 0.35 - point.z * 0.75;
  return {
    x: center.x + isoX * scale,
    y: center.y + isoY * scale
  };
};

const getPostureHeight = (posture) => {
  if (posture === "fallen") {
    return 0.4;
  }
  if (posture === "stumbling") {
    return 1.1;
  }
  return 1.5;
};

const drawArenaFloor = (center, scale, radius, focus) => {
  const floorCenter = projectPoint({ x: 0, y: 0, z: 0 }, center, scale, focus);
  ctx.save();
  ctx.strokeStyle = "rgba(123, 242, 195, 0.35)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(
    floorCenter.x,
    floorCenter.y + radius * scale * 0.12,
    radius * scale * 0.9,
    radius * scale * 0.5,
    0,
    0,
    Math.PI * 2
  );
  ctx.stroke();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
  ctx.lineWidth = 1;
  const spacing = 2;
  for (let x = -radius; x <= radius; x += spacing) {
    const start = projectPoint({ x, y: -radius, z: 0 }, center, scale, focus);
    const end = projectPoint({ x, y: radius, z: 0 }, center, scale, focus);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }
  for (let y = -radius; y <= radius; y += spacing) {
    const start = projectPoint({ x: -radius, y, z: 0 }, center, scale, focus);
    const end = projectPoint({ x: radius, y, z: 0 }, center, scale, focus);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }
  ctx.restore();
};

const drawActor = (center, scale, focus, actor, color, { glow = 12 } = {}) => {
  const postureHeight = getPostureHeight(actor.model.posture);
  const position = projectPoint(
    { x: actor.body.position.x, y: actor.body.position.y, z: 0 },
    center,
    scale,
    focus
  );
  const head = projectPoint(
    { x: actor.body.position.x, y: actor.body.position.y, z: postureHeight },
    center,
    scale,
    focus
  );

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.beginPath();
  ctx.ellipse(position.x, position.y + 6, 16, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(position.x, position.y);
  ctx.lineTo(head.x, head.y);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.beginPath();
  ctx.arc(head.x, head.y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawWeapon = (center, scale, focus, actor, weaponState, color) => {
  if (!weaponState) {
    return;
  }
  const { weapon, pose } = weaponState;
  const postureHeight = getPostureHeight(actor.model.posture);
  const handHeight = postureHeight * 0.7;
  const reach = Number.isFinite(pose.reach) ? pose.reach : weapon.length;
  const geometryScale = weapon.length > 0 ? reach / weapon.length : 1;
  const anchor = {
    x: actor.body.position.x,
    y: actor.body.position.y,
    z: handHeight
  };
  const tip = {
    x: anchor.x + Math.cos(pose.angle) * reach,
    y: anchor.y + Math.sin(pose.angle) * reach,
    z: handHeight + pose.swingPhase * 0.2
  };

  const anchorPoint = projectPoint(anchor, center, scale, focus);
  const tipPoint = projectPoint(tip, center, scale, focus);
  ctx.save();
  ctx.strokeStyle = pose.swinging ? "rgba(255, 214, 102, 0.9)" : color;
  ctx.lineWidth = pose.swinging ? 4 : 3;

  if (weapon.geometry?.points?.length) {
    const points = weapon.geometry.points.map((point) => {
      const rotated = {
        x: anchor.x + Math.cos(pose.angle) * point.x * geometryScale - Math.sin(pose.angle) * point.y * geometryScale,
        y: anchor.y + Math.sin(pose.angle) * point.x * geometryScale + Math.cos(pose.angle) * point.y * geometryScale,
        z: handHeight + pose.swingPhase * 0.2
      };
      return projectPoint(rotated, center, scale, focus);
    });

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.closePath();
    ctx.fillStyle = pose.swinging ? "rgba(255, 214, 102, 0.35)" : "rgba(255, 255, 255, 0.15)";
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(anchorPoint.x, anchorPoint.y);
    ctx.lineTo(tipPoint.x, tipPoint.y);
    ctx.stroke();
  }

  ctx.restore();
};

const render = (frame) => {
  const { width, height } = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, width, height);

  const center = computeViewportCenter(width, height);
  const radius = frame.arenaRadius;
  const baseScale = computeViewportScale(width, height, radius);
  const scale = reducedMotion ? baseScale * 0.9 : baseScale;
  const focus = reducedMotion ? { x: 0, y: 0 } : computeCameraFocus(frame);
  const glow = reducedMotion ? 0 : 12;

  ctx.fillStyle = "rgba(8, 10, 18, 0.85)";
  ctx.fillRect(0, 0, width, height);

  drawArenaFloor(center, scale, radius, focus);

  drawWeapon(center, scale, focus, frame.rival, frame.weapons?.rival, "rgba(255, 143, 122, 0.9)");
  drawWeapon(center, scale, focus, frame.player, frame.weapons?.player, "rgba(123, 242, 195, 0.95)");
  drawActor(center, scale, focus, frame.rival, "rgba(255, 143, 122, 0.9)", { glow });
  drawActor(center, scale, focus, frame.player, "rgba(123, 242, 195, 0.95)", { glow });
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
