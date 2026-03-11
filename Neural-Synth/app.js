const canvas = document.getElementById("synthCanvas");
const ctx = canvas.getContext("2d");

// Main UI controls.
const clearBtn = document.getElementById("clearBtn");
const magnetModeBtn = document.getElementById("magnetModeBtn");
const symmetryBtn = document.getElementById("symmetryBtn");
const recordBtn = document.getElementById("recordBtn");
const shakeBtn = document.getElementById("shakeBtn");
const statusText = document.getElementById("statusText");
const swatches = Array.from(document.querySelectorAll(".swatch"));

// Color palette used both for visuals and color-to-instrument mapping.
const THEME = {
  red: "#ff4d4d",
  blue: "#46a6ff",
  yellow: "#ffd84d"
};

// Web Audio context and top-level output node.
let audioCtx;
let masterGain;
let nowStarted = false;

// Interaction state.
let currentColor = "red";
let isDrawing = false;
let magnetMode = false;
let symmetryMode = false;
let lastPoint = null;
let motionListening = false;
let lastShakeTime = 0;

// Runtime scene containers.
const strokeSegments = [];
const magnets = [];
const sparks = [];

// Background ambient synth nodes.
let vibeNodes = null;

// 5-second looper state.
const recorder = {
  isRecording: false,
  hasLoop: false,
  startTime: 0,
  events: [],
  loopIntervalId: null,
  replayTimeouts: [],
  isReplaying: false
};

const RECORD_WINDOW_MS = 5000;

// Restricts value to a given numeric range.
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// Linear interpolation between two numbers.
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Matches internal canvas resolution to CSS size and device pixel ratio.
function resizeCanvas() {
  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  canvas.width = Math.floor(width * ratio);
  canvas.height = Math.floor(height * ratio);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
}

// Initializes the audio graph root once.
function initAudio() {
  if (audioCtx) {
    return;
  }

  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.85;
  masterGain.connect(audioCtx.destination);
}

// Resumes audio after user gesture (browser autoplay policy).
function ensureAudioStarted() {
  initAudio();
  if (!nowStarted && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  nowStarted = true;
}

// Creates a subtle ambient layer that reacts to canvas density.
function initBackgroundVibe() {
  if (!audioCtx || !masterGain || vibeNodes) {
    return;
  }

  const vibeGain = audioCtx.createGain();
  const vibeFilter = audioCtx.createBiquadFilter();
  const vibeOscA = audioCtx.createOscillator();
  const vibeOscB = audioCtx.createOscillator();
  const vibeLfo = audioCtx.createOscillator();
  const vibeLfoGain = audioCtx.createGain();

  vibeFilter.type = "lowpass";
  vibeFilter.frequency.value = 620;
  vibeFilter.Q.value = 0.8;

  vibeGain.gain.value = 0.001;

  vibeOscA.type = "sine";
  vibeOscB.type = "triangle";
  vibeOscA.frequency.value = 96;
  vibeOscB.frequency.value = 144;

  vibeLfo.type = "sine";
  vibeLfo.frequency.value = 0.17;
  vibeLfoGain.gain.value = 14;

  vibeLfo.connect(vibeLfoGain);
  vibeLfoGain.connect(vibeOscA.frequency);

  vibeOscA.connect(vibeFilter);
  vibeOscB.connect(vibeFilter);
  vibeFilter.connect(vibeGain);
  vibeGain.connect(masterGain);

  const now = audioCtx.currentTime;
  vibeOscA.start(now);
  vibeOscB.start(now);
  vibeLfo.start(now);

  vibeNodes = { vibeGain, vibeFilter, vibeOscA, vibeOscB };
}

// Converts vertical position to pitch (higher Y on screen means lower pitch).
function yToFrequency(y) {
  const h = canvas.clientHeight;
  const t = clamp(1 - y / h, 0, 1);
  return 70 * Math.pow(2, t * 4.4);
}

// Maps pointer speed to loudness, brightness, and envelope speed.
function speedToDynamics(speedPxPerSec) {
  const normalized = clamp(speedPxPerSec / 1400, 0, 1);
  return {
    gain: lerp(0.05, 0.35, normalized),
    filterCutoff: lerp(900, 6800, normalized),
    duration: lerp(0.22, 0.08, normalized)
  };
}

// Defines synthesis profile for each color instrument.
function instrumentProfile(color) {
  if (color === "red") {
    return { oscType: "sawtooth", filterType: "lowpass", baseCutoff: 600, feedback: 0.46, gainBoost: 1 };
  }
  if (color === "blue") {
    return { oscType: "triangle", filterType: "lowpass", baseCutoff: 1800, feedback: 0.28, gainBoost: 1 };
  }
  return { oscType: "square", filterType: "bandpass", baseCutoff: 2200, feedback: 0.38, gainBoost: 1.45 };
}

// Plays one short note with color-specific timbre and fading delay tail.
function playStrokeNote({ x, y, color, speed, lifeSeconds }) {
  if (!audioCtx || !masterGain) {
    return;
  }

  const profile = instrumentProfile(color);
  const freq = yToFrequency(y);
  const dyn = speedToDynamics(speed);
  const start = audioCtx.currentTime;
  const stop = start + lifeSeconds;

  const osc = audioCtx.createOscillator();
  const filter = audioCtx.createBiquadFilter();
  const amp = audioCtx.createGain();
  const delay = audioCtx.createDelay(1.0);
  const delayGain = audioCtx.createGain();
  const dry = audioCtx.createGain();

  osc.type = profile.oscType;
  osc.frequency.value = freq;

  filter.type = profile.filterType;
  filter.frequency.value = profile.baseCutoff + dyn.filterCutoff;
  filter.Q.value = color === "yellow" ? 5 : 1.6;

  delay.delayTime.value = 0.18 + Math.random() * 0.14;
  delayGain.gain.value = profile.feedback;
  dry.gain.value = 1;

  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(Math.max(0.0001, dyn.gain * profile.gainBoost), start + 0.01);
  amp.gain.exponentialRampToValueAtTime(0.0001, stop);

  // Echo trails fade with the same life envelope as the drawn segment.
  delayGain.gain.setValueAtTime(profile.feedback, start);
  delayGain.gain.exponentialRampToValueAtTime(0.001, stop);

  osc.connect(filter);
  filter.connect(amp);
  amp.connect(dry);
  dry.connect(masterGain);

  amp.connect(delay);
  delay.connect(delayGain);
  delayGain.connect(delay);
  delayGain.connect(masterGain);

  osc.start(start);
  osc.stop(stop + dyn.duration);
}

// Generates a brush path that looks like a live waveform around the line segment.
function makeWaveformPoints(from, to, speed, y) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const normalX = dist > 0 ? -dy / dist : 0;
  const normalY = dist > 0 ? dx / dist : 0;

  const steps = Math.max(8, Math.floor(dist / 7));
  const intensity = clamp(speed / 1400, 0.08, 1);
  const amp = lerp(1.6, 8.4, intensity);
  const frequency = yToFrequency(y);
  const wavelength = clamp(46 - (frequency / 1800) * 24, 18, 46);
  const phase = performance.now() * 0.01;

  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const px = lerp(from.x, to.x, t);
    const py = lerp(from.y, to.y, t);
    const wobble = Math.sin((t * dist) / wavelength * Math.PI * 2 + phase) * amp;
    points.push({
      x: px + normalX * wobble,
      y: py + normalY * wobble
    });
  }

  return points;
}

// Stores events while recording so they can be replayed in a loop.
function logRecordEvent(event) {
  if (!recorder.isRecording || recorder.isReplaying) {
    return;
  }

  const t = performance.now() - recorder.startTime;
  if (t <= RECORD_WINDOW_MS) {
    recorder.events.push({ ...event, t });
  }
}

// Creates one visual/audio stroke segment and optionally records the action.
function spawnStrokeSegment(from, to, color, speed, shouldRecord = true) {
  const life = clamp(0.6 + speed / 3000, 0.6, 1.3);
  const waveformPoints = makeWaveformPoints(from, to, speed, to.y);

  strokeSegments.push({
    from,
    to,
    color,
    points: waveformPoints,
    width: clamp(1.8 + speed / 650, 1.8, 7.5),
    life,
    maxLife: life
  });

  playStrokeNote({
    x: to.x,
    y: to.y,
    color,
    speed,
    lifeSeconds: life + 0.2
  });

  if (shouldRecord) {
    logRecordEvent({
      kind: "stroke",
      from,
      to,
      color,
      speed,
      symmetry: symmetryMode
    });
  }
}

// Mirrors a point around canvas center by X and/or Y axis.
function mirrorPoint(point, mirrorX, mirrorY) {
  const cx = canvas.clientWidth / 2;
  const cy = canvas.clientHeight / 2;
  return {
    x: mirrorX ? cx - (point.x - cx) : point.x,
    y: mirrorY ? cy - (point.y - cy) : point.y
  };
}

// Spawns the original stroke plus optional 3 mirrored copies (4-way symmetry).
function spawnSegmentWithSymmetry(from, to, color, speed, shouldRecord = true, applySymmetry = symmetryMode) {
  const transforms = applySymmetry
    ? [
      [false, false],
      [true, false],
      [false, true],
      [true, true]
    ]
    : [[false, false]];

  const dedupe = new Set();

  for (const [mx, my] of transforms) {
    const start = mirrorPoint(from, mx, my);
    const end = mirrorPoint(to, mx, my);
    const key = `${Math.round(start.x)}:${Math.round(start.y)}:${Math.round(end.x)}:${Math.round(end.y)}`;
    if (dedupe.has(key)) {
      continue;
    }
    dedupe.add(key);
    spawnStrokeSegment(start, end, color, speed, false);
  }

  if (shouldRecord) {
    logRecordEvent({ kind: "stroke", from, to, color, speed, symmetry: applySymmetry });
  }
}

// Adds a gravity magnet with orbiting particles that trigger notes.
function createMagnet(x, y) {
  const particleCount = 5 + Math.floor(Math.random() * 4);
  const particles = [];
  for (let i = 0; i < particleCount; i += 1) {
    const radius = 24 + Math.random() * 64;
    const angularSpeed = 0.5 + Math.random() * 1.2;
    particles.push({
      radius,
      angle: Math.random() * Math.PI * 2,
      angularSpeed,
      triggerInterval: 120 + Math.random() * 280,
      nextTrig: performance.now() + Math.random() * 600,
      color: ["red", "blue", "yellow"][Math.floor(Math.random() * 3)]
    });
  }

  magnets.push({ x, y, particles });
}

// Plays a short pulse from a magnet particle and adds a tiny visual flash.
function playParticlePulse(magnet, particle) {
  if (!audioCtx || !masterGain) {
    return;
  }

  const px = magnet.x + Math.cos(particle.angle) * particle.radius;
  const py = magnet.y + Math.sin(particle.angle) * particle.radius;

  playStrokeNote({
    x: px,
    y: py,
    color: particle.color,
    speed: 420 + particle.angularSpeed * 260,
    lifeSeconds: 0.36
  });

  strokeSegments.push({
    from: { x: px - 2, y: py - 2 },
    to: { x: px + 2, y: py + 2 },
    color: particle.color,
    width: 2.2,
    life: 0.5,
    maxLife: 0.5
  });
}

// Converts pointer coordinates from viewport space to canvas-local space.
function getCanvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
    t: performance.now()
  };
}

// Updates selected color swatch highlight.
function updateSwatchState() {
  for (const swatch of swatches) {
    swatch.classList.toggle("active", swatch.dataset.color === currentColor);
  }
}

// Renders current looper state text in the legend panel.
function updateStatusText() {
  if (recorder.isRecording) {
    statusText.textContent = "Looper: REC";
    return;
  }
  if (recorder.hasLoop) {
    statusText.textContent = `Looper: ON (${(recorder.events.length || 0)} evt)`;
    return;
  }
  statusText.textContent = "Looper: OFF";
}

// Cancels all scheduled replay timeouts for the looper.
function clearReplayTimers() {
  for (const id of recorder.replayTimeouts) {
    clearTimeout(id);
  }
  recorder.replayTimeouts.length = 0;
}

// Replays one recorded event.
function replayRecordedEvent(event) {
  if (event.kind === "stroke") {
    spawnSegmentWithSymmetry(event.from, event.to, event.color, event.speed, false, event.symmetry);
  }
}

// Schedules one 5-second pass of all recorded events.
function scheduleLoopPass() {
  clearReplayTimers();
  recorder.isReplaying = true;

  for (const event of recorder.events) {
    const timeoutId = setTimeout(() => {
      replayRecordedEvent(event);
    }, event.t);
    recorder.replayTimeouts.push(timeoutId);
  }

  const guard = setTimeout(() => {
    recorder.isReplaying = false;
  }, RECORD_WINDOW_MS + 30);
  recorder.replayTimeouts.push(guard);
}

// Stops loop playback and resets looper UI/state.
function stopLoopPlayback() {
  if (recorder.loopIntervalId) {
    clearInterval(recorder.loopIntervalId);
    recorder.loopIntervalId = null;
  }
  clearReplayTimers();
  recorder.hasLoop = false;
  recorder.isReplaying = false;
  recorder.events = [];
  recordBtn.classList.remove("looping", "recording");
  recordBtn.textContent = "Record 5s";
  updateStatusText();
}

// Finishes recording and starts looping if there are captured events.
function finishRecording() {
  recorder.isRecording = false;

  if (!recorder.events.length) {
    recordBtn.classList.remove("recording", "looping");
    recordBtn.textContent = "Record 5s";
    updateStatusText();
    return;
  }

  recorder.hasLoop = true;
  recordBtn.classList.remove("recording");
  recordBtn.classList.add("looping");
  recordBtn.textContent = "Stop Loop";
  scheduleLoopPass();
  recorder.loopIntervalId = setInterval(scheduleLoopPass, RECORD_WINDOW_MS);
  updateStatusText();
}

// Starts a fresh 5-second recording window.
function startRecording() {
  ensureAudioStarted();
  initBackgroundVibe();

  recorder.events = [];
  recorder.startTime = performance.now();
  recorder.isRecording = true;
  recorder.hasLoop = false;

  recordBtn.classList.add("recording");
  recordBtn.classList.remove("looping");
  recordBtn.textContent = "Recording...";
  updateStatusText();

  setTimeout(() => {
    if (!recorder.isRecording) {
      return;
    }
    finishRecording();
  }, RECORD_WINDOW_MS);
}

// Quickly ducks and restores master output for the clear/shake effect.
function fadeMasterQuickly() {
  if (!audioCtx || !masterGain) {
    return;
  }
  const now = audioCtx.currentTime;
  const restored = 0.85;
  masterGain.gain.cancelScheduledValues(now);
  masterGain.gain.setValueAtTime(Math.max(masterGain.gain.value, 0.0001), now);
  masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
  masterGain.gain.exponentialRampToValueAtTime(restored, now + 1.0);
}

// Turns current drawing content into short-lived spark particles.
function createSparkBurst() {
  const sourcePoints = [];
  for (let i = 0; i < strokeSegments.length; i += 1) {
    const seg = strokeSegments[i];
    sourcePoints.push({ x: seg.to.x, y: seg.to.y, color: seg.color });
    if (sourcePoints.length > 220) {
      break;
    }
  }

  for (const magnet of magnets) {
    sourcePoints.push({ x: magnet.x, y: magnet.y, color: "blue" });
  }

  for (const p of sourcePoints) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 40 + Math.random() * 280;
    sparks.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.8 + Math.random() * 0.7,
      maxLife: 1.4,
      color: p.color
    });
  }
}

// Clears scene content with spark burst and audio fade.
function shakeClear() {
  createSparkBurst();
  strokeSegments.length = 0;
  magnets.length = 0;
  fadeMasterQuickly();
}

// Detects strong accelerometer movement and triggers shake clear.
function onDeviceMotion(event) {
  const acc = event.accelerationIncludingGravity;
  if (!acc) {
    return;
  }

  const x = acc.x || 0;
  const y = acc.y || 0;
  const z = acc.z || 0;
  const magnitude = Math.sqrt(x * x + y * y + z * z);
  const now = performance.now();

  if (magnitude > 19 && now - lastShakeTime > 900) {
    lastShakeTime = now;
    shakeClear();
  }
}

// Enables device motion listener (handles iOS permission flow).
async function enableShakeListening() {
  if (motionListening || typeof DeviceMotionEvent === "undefined") {
    return;
  }

  if (typeof DeviceMotionEvent.requestPermission === "function") {
    const permission = await DeviceMotionEvent.requestPermission();
    if (permission !== "granted") {
      return;
    }
  }

  window.addEventListener("devicemotion", onDeviceMotion);
  motionListening = true;
}

// Starts drawing or places a magnet based on current mode.
function onPointerDown(event) {
  const point = getCanvasPoint(event);
  ensureAudioStarted();
  initBackgroundVibe();

  if (magnetMode) {
    createMagnet(point.x, point.y);
    return;
  }

  isDrawing = true;
  lastPoint = point;
}

// Draws continuous strokes and derives dynamics from pointer speed.
function onPointerMove(event) {
  if (!isDrawing || !lastPoint) {
    return;
  }

  const point = getCanvasPoint(event);
  const dt = Math.max((point.t - lastPoint.t) / 1000, 0.001);
  const dist = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
  const speed = dist / dt;

  if (dist > 0.6) {
    spawnSegmentWithSymmetry(
      { x: lastPoint.x, y: lastPoint.y },
      { x: point.x, y: point.y },
      currentColor,
      speed
    );
  }

  lastPoint = point;
}

// Stops drawing when pointer is released.
function onPointerUp() {
  isDrawing = false;
  lastPoint = null;
}

// Advances magnet orbits and triggers periodic particle pulses.
function updateMagnetParticles(deltaMs, now) {
  const deltaSec = deltaMs / 1000;

  for (const magnet of magnets) {
    for (const p of magnet.particles) {
      p.angle += p.angularSpeed * deltaSec;
      if (now >= p.nextTrig) {
        playParticlePulse(magnet, p);
        p.nextTrig = now + p.triggerInterval;
      }
    }
  }
}

// Simulates spark particle physics and culls expired particles.
function updateSparks(deltaMs) {
  const deltaSec = deltaMs / 1000;
  for (let i = sparks.length - 1; i >= 0; i -= 1) {
    const s = sparks[i];
    s.life -= deltaSec;
    if (s.life <= 0) {
      sparks.splice(i, 1);
      continue;
    }
    s.x += s.vx * deltaSec;
    s.y += s.vy * deltaSec;
    s.vx *= 0.97;
    s.vy *= 0.97;
    s.vy += 120 * deltaSec;
  }
}

// Modulates ambient background vibe by current visual activity density.
function updateBackgroundVibe() {
  if (!audioCtx || !vibeNodes) {
    return;
  }

  const painted = strokeSegments.length + magnets.length * 10 + sparks.length * 0.15;
  const density = clamp(painted / 220, 0, 1);
  const now = audioCtx.currentTime;

  const gainTarget = 0.008 + density * 0.06;
  const filterTarget = 520 + density * 3200;
  const oscATarget = 82 + density * 36;
  const oscBTarget = 121 + density * 68;

  vibeNodes.vibeGain.gain.setTargetAtTime(gainTarget, now, 0.5);
  vibeNodes.vibeFilter.frequency.setTargetAtTime(filterTarget, now, 0.45);
  vibeNodes.vibeOscA.frequency.setTargetAtTime(oscATarget, now, 0.6);
  vibeNodes.vibeOscB.frequency.setTargetAtTime(oscBTarget, now, 0.6);
}

// Renders all transient visuals and runs per-frame simulation updates.
function drawFrame(deltaMs, now) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;

  ctx.clearRect(0, 0, width, height);

  for (let i = strokeSegments.length - 1; i >= 0; i -= 1) {
    const seg = strokeSegments[i];
    seg.life -= deltaMs / 1000;

    if (seg.life <= 0) {
      strokeSegments.splice(i, 1);
      continue;
    }

    const alpha = clamp(seg.life / seg.maxLife, 0, 1);
    ctx.strokeStyle = hexToRgba(THEME[seg.color], alpha);
    ctx.lineWidth = seg.width;
    ctx.lineCap = "round";

    if (seg.points && seg.points.length > 1) {
      ctx.beginPath();
      ctx.moveTo(seg.points[0].x, seg.points[0].y);
      for (let p = 1; p < seg.points.length; p += 1) {
        ctx.lineTo(seg.points[p].x, seg.points[p].y);
      }
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(seg.from.x, seg.from.y);
      ctx.lineTo(seg.to.x, seg.to.y);
      ctx.stroke();
    }
  }

  for (const magnet of magnets) {
    ctx.beginPath();
    ctx.fillStyle = "rgba(230, 247, 255, 0.92)";
    ctx.arc(magnet.x, magnet.y, 5, 0, Math.PI * 2);
    ctx.fill();

    for (const p of magnet.particles) {
      const px = magnet.x + Math.cos(p.angle) * p.radius;
      const py = magnet.y + Math.sin(p.angle) * p.radius;

      ctx.beginPath();
      ctx.strokeStyle = "rgba(183, 223, 255, 0.2)";
      ctx.lineWidth = 1;
      ctx.arc(magnet.x, magnet.y, p.radius, 0, Math.PI * 2);
      ctx.stroke();

      ctx.beginPath();
      ctx.fillStyle = hexToRgba(THEME[p.color], 0.88);
      ctx.arc(px, py, 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const s of sparks) {
    const alpha = clamp(s.life / s.maxLife, 0, 1);
    ctx.beginPath();
    ctx.fillStyle = hexToRgba(THEME[s.color] || THEME.blue, alpha);
    ctx.arc(s.x, s.y, 1.8 + alpha * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  updateMagnetParticles(deltaMs, now);
  updateSparks(deltaMs);
  updateBackgroundVibe();
}

// Converts #RRGGBB to rgba() with supplied alpha.
function hexToRgba(hex, alpha) {
  const normalized = hex.replace("#", "");
  const bigint = parseInt(normalized, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Animation loop timestamp state.
let prevTime = performance.now();

// Main animation tick.
function animate(now) {
  const delta = now - prevTime;
  prevTime = now;

  drawFrame(delta, now);
  requestAnimationFrame(animate);
}

// Hard clear without spark effect.
function clearAll() {
  strokeSegments.length = 0;
  magnets.length = 0;
  sparks.length = 0;
}

// Color palette selection handlers.
for (const swatch of swatches) {
  swatch.addEventListener("click", () => {
    currentColor = swatch.dataset.color;
    updateSwatchState();
  });
}

// Clear button handler.
clearBtn.addEventListener("click", clearAll);

// Magnet mode toggle.
magnetModeBtn.addEventListener("click", () => {
  magnetMode = !magnetMode;
  magnetModeBtn.textContent = `Magnetid: ${magnetMode ? "ON" : "OFF"}`;
});

// Symmetry mode toggle.
symmetryBtn.addEventListener("click", () => {
  symmetryMode = !symmetryMode;
  symmetryBtn.textContent = `Sümmeetria: ${symmetryMode ? "ON" : "OFF"}`;
});

// Record button state machine: record -> loop -> stop.
recordBtn.addEventListener("click", () => {
  if (recorder.isRecording) {
    finishRecording();
    return;
  }
  if (recorder.hasLoop) {
    stopLoopPlayback();
    return;
  }
  startRecording();
});

// Shake button: enables motion sensing and triggers immediate shake clear.
shakeBtn.addEventListener("click", async () => {
  ensureAudioStarted();
  initBackgroundVibe();
  await enableShakeListening();
  shakeClear();
});

// Pointer and resize listeners.
canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", onPointerUp);
window.addEventListener("resize", resizeCanvas);

// Initial app setup.
resizeCanvas();
updateSwatchState();
updateStatusText();
requestAnimationFrame(animate);
