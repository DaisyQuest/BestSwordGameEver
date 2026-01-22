import { createDemoSession } from "../shared/demo/demoSession.js";

const canvas = document.querySelector("#arena");
const ctx = canvas.getContext("2d");

const healthFill = document.querySelector("#health-fill");
const healthValue = document.querySelector("#health-value");
const staminaFill = document.querySelector("#stamina-fill");
const staminaValue = document.querySelector("#stamina-value");
const rivalHealthFill = document.querySelector("#rival-health-fill");
const rivalHealthValue = document.querySelector("#rival-health-value");
const postureEl = document.querySelector("#posture");
const speedEl = document.querySelector("#speed");
const intentEl = document.querySelector("#intent");
const motionEl = document.querySelector("#motion");
const weaponStatusEl = document.querySelector("#weapon-status");
const weaponAngleEl = document.querySelector("#weapon-angle");
const weaponLoadoutEl = document.querySelector("#weapon-loadout");
const resetButton = document.querySelector("#reset");

const session = createDemoSession({
  balance: { impactThreshold: 0 },
  stamina: { max: 100, regenRate: 12, sprintCost: 24, exhaustionThreshold: 0.2 },
  physics: { gravity: { x: 0, y: 0 }, maxSpeed: 18 },
  body: { damping: 0.94, mass: 1.3 }
});

const ACTOR_RENDER = {
  height: {
    fallen: 0.6,
    stumbling: 1.4,
    steady: 1.9
  },
  shadow: { x: 22, y: 8 },
  spineWidth: 8,
  headRadius: 14
};
const WEAPON_RENDER_SCALE = 1.35;
const AIM_HEIGHT_MAX = ACTOR_RENDER.height.steady + 0.6;

const inputState = new Set();
let lastTime = null;
let state = session.getSnapshot();
let reducedMotion = false;
const pointerState = {
  x: 0,
  y: 0,
  active: false,
  attack: false
};
const weaponPresets = [
  {
    label: "Vanguard",
    weapons: {
      player: { type: "sword", sharpness: 0.8, mass: 3.2, length: 1.25, balance: 0.6 },
      rival: { type: "spear", sharpness: 0.65, mass: 3.8, length: 1.8, balance: 0.45 }
    }
  },
  {
    label: "Colossus",
    weapons: {
      player: { type: "greatsword", sharpness: 0.75, mass: 4.6, length: 1.7, balance: 0.5 },
      rival: { type: "halberd", sharpness: 0.6, mass: 4.2, length: 1.9, balance: 0.4 }
    }
  },
  {
    label: "Breaker",
    weapons: {
      player: { type: "mace", sharpness: 0.3, mass: 4.8, length: 1.1, balance: 0.35 },
      rival: { type: "club", sharpness: 0.2, mass: 4.4, length: 1.05, balance: 0.4 }
    }
  },
  {
    label: "Skirmish",
    weapons: {
      player: { type: "dagger", sharpness: 0.9, mass: 1.1, length: 0.55, balance: 0.7 },
      rival: { type: "sword", sharpness: 0.7, mass: 2.8, length: 1.15, balance: 0.55 }
    }
  }
];
let weaponPresetIndex = 0;

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
  if (event.code === "KeyV" && active) {
    weaponPresetIndex = (weaponPresetIndex + 1) % weaponPresets.length;
    state = session.setWeapons(weaponPresets[weaponPresetIndex].weapons);
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
const updatePointer = (event) => {
  const rect = canvas.getBoundingClientRect();
  pointerState.x = event.clientX - rect.left;
  pointerState.y = event.clientY - rect.top;
  pointerState.active = true;
};
canvas.addEventListener("pointermove", updatePointer);
canvas.addEventListener("pointerdown", (event) => {
  updatePointer(event);
  pointerState.attack = true;
});
window.addEventListener("pointerup", () => {
  pointerState.attack = false;
});
canvas.addEventListener("pointerleave", () => {
  pointerState.active = false;
  pointerState.attack = false;
});

const buildInputs = () =>
  Array.from(inputState).map((code) => ({
    code,
    active: true
  }));

const wantsSprint = () => inputState.has("ShiftLeft") || inputState.has("ShiftRight");

const updateHud = (frame) => {
  if (frame.health?.player && healthFill && healthValue) {
    const playerHealth = frame.health.player;
    const ratio = playerHealth.max > 0 ? playerHealth.current / playerHealth.max : 0;
    healthFill.style.width = `${Math.round(ratio * 100)}%`;
    healthValue.textContent = `${Math.round(playerHealth.current)} / ${playerHealth.max}`;
  }
  if (frame.health?.rival && rivalHealthFill && rivalHealthValue) {
    const rivalHealth = frame.health.rival;
    const ratio = rivalHealth.max > 0 ? rivalHealth.current / rivalHealth.max : 0;
    rivalHealthFill.style.width = `${Math.round(ratio * 100)}%`;
    rivalHealthValue.textContent = `${Math.round(rivalHealth.current)} / ${rivalHealth.max}`;
  }
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
  if (weaponStatusEl) {
    const weaponState = frame.weaponControl;
    if (weaponState?.attack) {
      weaponStatusEl.textContent = "Striking";
    } else if (weaponState?.guard) {
      weaponStatusEl.textContent = "Guarding";
    } else {
      weaponStatusEl.textContent = "Ready";
    }
  }
  if (weaponAngleEl) {
    const angle = frame.weapons?.player?.pose?.angle ?? 0;
    const degrees = ((angle * 180) / Math.PI + 360) % 360;
    weaponAngleEl.textContent = `${degrees.toFixed(0)}°`;
  }
  if (weaponLoadoutEl) {
    weaponLoadoutEl.textContent = weaponPresets[weaponPresetIndex]?.label ?? "Custom";
  }
};

const CAMERA_PROFILE = {
  followDistance: 5.2,
  shoulderOffset: 1.3,
  height: 2.6,
  lookAhead: 3.2,
  centerBiasX: 0.5,
  centerBiasY: 0.7,
  zoomScale: 1.2,
  fov: 6.5
};

const normalize2d = (vector) => {
  const length = Math.hypot(vector.x, vector.y);
  if (length <= 0) {
    return { x: 1, y: 0 };
  }
  return { x: vector.x / length, y: vector.y / length };
};

const normalize3d = (vector) => {
  const length = Math.hypot(vector.x, vector.y, vector.z);
  if (length <= 0) {
    return { x: 0, y: 0, z: 1 };
  }
  return { x: vector.x / length, y: vector.y / length, z: vector.z / length };
};

const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x
});

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

const computeCameraRig = (frame) => {
  const toRival = {
    x: frame.rival.body.position.x - frame.player.body.position.x,
    y: frame.rival.body.position.y - frame.player.body.position.y
  };
  const direction = normalize2d(toRival);
  const shoulder = { x: -direction.y, y: direction.x };
  const playerHeight = frame.player.body.position.z;
  const position = {
    x:
      frame.player.body.position.x -
      direction.x * CAMERA_PROFILE.followDistance +
      shoulder.x * CAMERA_PROFILE.shoulderOffset,
    y:
      frame.player.body.position.y -
      direction.y * CAMERA_PROFILE.followDistance +
      shoulder.y * CAMERA_PROFILE.shoulderOffset,
    z: playerHeight + CAMERA_PROFILE.height
  };
  const lookAt = {
    x: frame.player.body.position.x + direction.x * CAMERA_PROFILE.lookAhead,
    y: frame.player.body.position.y + direction.y * CAMERA_PROFILE.lookAhead,
    z: playerHeight + CAMERA_PROFILE.height * 0.45
  };
  const forward = normalize3d({
    x: lookAt.x - position.x,
    y: lookAt.y - position.y,
    z: lookAt.z - position.z
  });
  const worldUp = { x: 0, y: 0, z: 1 };
  const right = normalize3d(cross(forward, worldUp));
  const up = cross(right, forward);
  return {
    position,
    forward,
    right,
    up
  };
};

const computeViewportCenter = (width, height) => ({
  x: width * CAMERA_PROFILE.centerBiasX,
  y: height * CAMERA_PROFILE.centerBiasY
});

const computeViewportScale = (width, height, radius) =>
  (Math.min(width, height) / (radius * 2)) * CAMERA_PROFILE.zoomScale;

const projectPoint = (point, center, scale, camera) => {
  const relative = {
    x: point.x - camera.position.x,
    y: point.y - camera.position.y,
    z: point.z - camera.position.z
  };
  const cameraX = dot(relative, camera.right);
  const cameraY = dot(relative, camera.up);
  const cameraZ = dot(relative, camera.forward);
  const perspective = CAMERA_PROFILE.fov / (CAMERA_PROFILE.fov + cameraZ);
  return {
    x: center.x + cameraX * scale * perspective,
    y: center.y - cameraY * scale * perspective
  };
};

const unprojectPoint = (screen, center, scale, camera) => {
  const screenX = (screen.x - center.x) / scale;
  const screenY = (center.y - screen.y) / scale;
  const direction = normalize3d({
    x: screenX,
    y: screenY,
    z: CAMERA_PROFILE.fov
  });
  const worldDirection = {
    x: camera.right.x * direction.x + camera.up.x * direction.y + camera.forward.x * direction.z,
    y: camera.right.y * direction.x + camera.up.y * direction.y + camera.forward.y * direction.z,
    z: camera.right.z * direction.x + camera.up.z * direction.y + camera.forward.z * direction.z
  };
  if (Math.abs(worldDirection.z) < 0.0001) {
    return null;
  }
  const t = (0 - camera.position.z) / worldDirection.z;
  if (t <= 0) {
    return null;
  }
  return {
    x: camera.position.x + worldDirection.x * t,
    y: camera.position.y + worldDirection.y * t,
    z: 0
  };
};

const getPostureHeight = (posture) => {
  if (posture === "fallen") {
    return ACTOR_RENDER.height.fallen;
  }
  if (posture === "stumbling") {
    return ACTOR_RENDER.height.stumbling;
  }
  return ACTOR_RENDER.height.steady;
};

const drawArenaFloor = (center, scale, radius, camera) => {
  const floorCenter = projectPoint({ x: 0, y: 0, z: 0 }, center, scale, camera);
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
    const start = projectPoint({ x, y: -radius, z: 0 }, center, scale, camera);
    const end = projectPoint({ x, y: radius, z: 0 }, center, scale, camera);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }
  for (let y = -radius; y <= radius; y += spacing) {
    const start = projectPoint({ x: -radius, y, z: 0 }, center, scale, camera);
    const end = projectPoint({ x: radius, y, z: 0 }, center, scale, camera);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }
  ctx.restore();
};

const drawActor = (center, scale, camera, actor, color, { glow = 12 } = {}) => {
  const postureHeight = getPostureHeight(actor.model.posture);
  const position = projectPoint(
    { x: actor.body.position.x, y: actor.body.position.y, z: actor.body.position.z },
    center,
    scale,
    camera
  );
  const head = projectPoint(
    { x: actor.body.position.x, y: actor.body.position.y, z: actor.body.position.z + postureHeight },
    center,
    scale,
    camera
  );

  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
  ctx.beginPath();
  ctx.ellipse(
    position.x,
    position.y + 8,
    ACTOR_RENDER.shadow.x,
    ACTOR_RENDER.shadow.y,
    0,
    0,
    Math.PI * 2
  );
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = ACTOR_RENDER.spineWidth;
  ctx.beginPath();
  ctx.moveTo(position.x, position.y);
  ctx.lineTo(head.x, head.y);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.beginPath();
  ctx.arc(head.x, head.y, ACTOR_RENDER.headRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawWeapon = (center, scale, camera, actor, weaponState, color) => {
  if (!weaponState) {
    return;
  }
  const { weapon, pose } = weaponState;
  const postureHeight = getPostureHeight(actor.model.posture);
  const handHeight = postureHeight * 0.7;
  const reach = Number.isFinite(pose.reach) ? pose.reach : weapon.length;
  const pitch = pose.pitch ?? 0;
  const renderReach = reach * WEAPON_RENDER_SCALE;
  const horizontalReach = renderReach * Math.cos(pitch);
  const zOffset = renderReach * Math.sin(pitch);
  const geometryScale = weapon.length > 0 ? renderReach / weapon.length : 1;
  const anchor = {
    x: actor.body.position.x,
    y: actor.body.position.y,
    z: actor.body.position.z + handHeight
  };
  const tip = {
    x: anchor.x + Math.cos(pose.angle) * horizontalReach,
    y: anchor.y + Math.sin(pose.angle) * horizontalReach,
    z: anchor.z + pose.swingPhase * 0.2 + zOffset
  };

  const anchorPoint = projectPoint(anchor, center, scale, camera);
  const tipPoint = projectPoint(tip, center, scale, camera);
  ctx.save();
  ctx.strokeStyle = pose.swinging ? "rgba(255, 214, 102, 0.9)" : color;
  ctx.lineWidth = pose.swinging ? 6 : 5;

  if (weapon.geometry?.points?.length) {
    const points = weapon.geometry.points.map((point) => {
      const rotated = {
        x: anchor.x + Math.cos(pose.angle) * point.x * geometryScale - Math.sin(pose.angle) * point.y * geometryScale,
        y: anchor.y + Math.sin(pose.angle) * point.x * geometryScale + Math.cos(pose.angle) * point.y * geometryScale,
        z: anchor.z + pose.swingPhase * 0.2 + zOffset
      };
      return projectPoint(rotated, center, scale, camera);
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

const drawWeaponTrail = (center, scale, camera, actor, weaponState, color) => {
  if (!weaponState?.pose?.swinging) {
    return;
  }
  const { weapon, pose } = weaponState;
  const postureHeight = getPostureHeight(actor.model.posture);
  const handHeight = postureHeight * 0.7;
  const reach = Number.isFinite(pose.reach) ? pose.reach : weapon.length;
  const pitch = pose.pitch ?? 0;
  const renderReach = reach * WEAPON_RENDER_SCALE;
  const horizontalReach = renderReach * Math.cos(pitch);
  const zOffset = renderReach * Math.sin(pitch);
  const trailSpread = 0.7;
  const startAngle = pose.angle - trailSpread / 2;
  const endAngle = pose.angle + trailSpread / 2;
  const segments = 14;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  for (let i = 0; i <= segments; i += 1) {
    const t = i / segments;
    const angle = startAngle + (endAngle - startAngle) * t;
    const tip = {
      x: actor.body.position.x + Math.cos(angle) * horizontalReach,
      y: actor.body.position.y + Math.sin(angle) * horizontalReach,
      z: actor.body.position.z + handHeight + pose.swingPhase * 0.2 + zOffset
    };
    const projected = projectPoint(tip, center, scale, camera);
    if (i === 0) {
      ctx.moveTo(projected.x, projected.y);
    } else {
      ctx.lineTo(projected.x, projected.y);
    }
  }
  ctx.stroke();
  ctx.restore();
};

const drawArenaPulse = (center, scale, radius, camera, timeMs) => {
  const pulse = 0.5 + Math.sin(timeMs / 900) * 0.5;
  const pulseRadius = radius * (0.9 + pulse * 0.1);
  const pulseCenter = projectPoint({ x: 0, y: 0, z: 0 }, center, scale, camera);
  ctx.save();
  ctx.strokeStyle = `rgba(123, 242, 195, ${0.08 + pulse * 0.1})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(
    pulseCenter.x,
    pulseCenter.y + pulseRadius * scale * 0.1,
    pulseRadius * scale * 0.88,
    pulseRadius * scale * 0.5,
    0,
    0,
    Math.PI * 2
  );
  ctx.stroke();
  ctx.restore();
};

const drawSpeedStreaks = (center, scale, camera, actor, speed, color) => {
  if (speed < 4) {
    return;
  }
  const streaks = Math.min(6, Math.ceil(speed / 2));
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = Math.min(0.6, speed / 10);
  for (let i = 0; i < streaks; i += 1) {
    const angle = (Math.PI * 2 * i) / streaks + speed * 0.05;
    const start = projectPoint(
      {
        x: actor.body.position.x + Math.cos(angle) * 0.4,
        y: actor.body.position.y + Math.sin(angle) * 0.4,
        z: actor.body.position.z + 0.3
      },
      center,
      scale,
      camera
    );
    const end = projectPoint(
      {
        x: actor.body.position.x + Math.cos(angle) * 1.2,
        y: actor.body.position.y + Math.sin(angle) * 1.2,
        z: actor.body.position.z + 0.1
      },
      center,
      scale,
      camera
    );
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
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
  const camera = reducedMotion
    ? {
      position: { x: 0, y: 0, z: CAMERA_PROFILE.height },
      forward: { x: 0, y: 1, z: -0.3 },
      right: { x: 1, y: 0, z: 0 },
      up: { x: 0, y: 0.3, z: 1 }
    }
    : computeCameraRig(frame);
  const glow = reducedMotion ? 0 : 12;

  ctx.fillStyle = "rgba(8, 10, 18, 0.85)";
  ctx.fillRect(0, 0, width, height);

  drawArenaFloor(center, scale, radius, camera);
  drawArenaPulse(center, scale, radius, camera, frame.timeMs);

  drawWeaponTrail(center, scale, camera, frame.rival, frame.weapons?.rival, "rgba(255, 143, 122, 0.55)");
  drawWeaponTrail(center, scale, camera, frame.player, frame.weapons?.player, "rgba(123, 242, 195, 0.65)");
  drawWeapon(center, scale, camera, frame.rival, frame.weapons?.rival, "rgba(255, 143, 122, 0.9)");
  drawWeapon(center, scale, camera, frame.player, frame.weapons?.player, "rgba(123, 242, 195, 0.95)");
  drawSpeedStreaks(center, scale, camera, frame.player, frame.speed, "rgba(123, 242, 195, 0.7)");
  drawSpeedStreaks(center, scale, camera, frame.rival, frame.speed * 0.7, "rgba(255, 143, 122, 0.7)");
  drawActor(center, scale, camera, frame.rival, "rgba(255, 143, 122, 0.9)", { glow });
  drawActor(center, scale, camera, frame.player, "rgba(123, 242, 195, 0.95)", { glow });
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

  const { width, height } = canvas.getBoundingClientRect();
  const center = computeViewportCenter(width, height);
  const baseScale = computeViewportScale(width, height, state.arenaRadius);
  const camera = reducedMotion
    ? {
      position: { x: 0, y: 0, z: CAMERA_PROFILE.height },
      forward: { x: 0, y: 1, z: -0.3 },
      right: { x: 1, y: 0, z: 0 },
      up: { x: 0, y: 0.3, z: 1 }
    }
    : computeCameraRig(state);
  const aimTarget = pointerState.active
    ? unprojectPoint({ x: pointerState.x, y: pointerState.y }, center, baseScale, camera)
    : null;
  if (aimTarget) {
    const normalizedY = Math.max(0, Math.min(1, 1 - pointerState.y / height));
    aimTarget.z = normalizedY * AIM_HEIGHT_MAX;
  }
  const attackActive =
    pointerState.attack || inputState.has("Space") || inputState.has("KeyF");
  const guardActive = inputState.has("KeyQ");
  state = session.step(deltaMs, buildInputs(), {
    sprint: wantsSprint(),
    weapon: {
      aim: aimTarget,
      attack: attackActive,
      guard: guardActive
    }
  });
  const speed = Math.hypot(state.player.body.velocity.x, state.player.body.velocity.y, state.player.body.velocity.z);
  const frame = { ...state, speed };
  updateHud(frame);
  render(frame);

  requestAnimationFrame(loop);
};

resizeCanvas();
requestAnimationFrame(loop);
