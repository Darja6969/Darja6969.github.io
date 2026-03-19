const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const sproutRunningImg = new Image();
let sproutRunningReady = false;
sproutRunningImg.src = "sprout-running.png";
sproutRunningImg.addEventListener("load", () => {
  sproutRunningReady = true;
});

const sproutStandingImg = new Image();
let sproutStandingReady = false;
sproutStandingImg.src = "sprout-standing.png";
sproutStandingImg.addEventListener("load", () => {
  sproutStandingReady = true;
});

const coinsEl = document.getElementById("coins");
const livesEl = document.getElementById("lives");
const levelEl = document.getElementById("level");
const messageEl = document.getElementById("message");
const startScreenEl = document.getElementById("startScreen");
const startBtn = document.getElementById("startBtn");
const fullscreenBtn = document.getElementById("fullscreenBtn");

const GRAVITY = 0.45;
const BASE_FRICTION = 0.82;
const BOOST_FRICTION = 0.9;
const BASE_MAX_SPEED = 6.8;
const BOOST_MAX_SPEED = 13.5;
const BASE_ACCEL = 0.65;
const BOOST_ACCEL = 1.08;
const JUMP_SPEED = -12.2;
const BOOST_DURATION = 14 * 60;
const LEVEL_Y_SHIFT = -70;
const PLAYER_PNG_SCALE = 1.7;

const keys = {
  left: false,
  right: false,
  jump: false,
};

const gameState = {
  mode: "start",
  levelIndex: 0,
  totalCoins: 0,
  cameraX: 0,
  frame: 0,
};

const player = {
  x: 80,
  y: 220,
  w: 34,
  h: 48,
  vx: 0,
  vy: 0,
  onGround: false,
  jumpLatch: false,
  facing: 1,
  lives: 3,
  speedBoostFrames: 0,
  speedBoostTier: 0,
};

const levels = [
  {
    name: "1-1",
    worldWidth: 3600,
    spawn: { x: 80, y: 220 },
    flag: { x: 3470, y: 280, w: 20, h: 220 },
    platforms: [
      { x: 0, y: 500, w: 1000, h: 60, type: "ground" },
      { x: 1080, y: 500, w: 920, h: 60, type: "ground" },
      { x: 2070, y: 500, w: 680, h: 60, type: "ground" },
      { x: 2820, y: 500, w: 800, h: 60, type: "ground" },
      { x: 330, y: 420, w: 120, h: 24, type: "brick" },
      { x: 560, y: 360, w: 120, h: 24, type: "power" },
      { x: 810, y: 300, w: 120, h: 24, type: "brick" },
      { x: 1510, y: 410, w: 120, h: 24, type: "bonus" },
      { x: 1780, y: 340, w: 120, h: 24, type: "brick" },
      { x: 2040, y: 270, w: 120, h: 24, type: "brick" },
      { x: 2440, y: 380, w: 120, h: 24, type: "brick" },
      { x: 2630, y: 310, w: 120, h: 24, type: "power" },
      { x: 3100, y: 400, w: 130, h: 24, type: "brick" },
    ],
    coins: [
      { x: 370, y: 380, r: 10 },
      { x: 600, y: 320, r: 10 },
      { x: 850, y: 260, r: 10 },
      { x: 1540, y: 370, r: 10 },
      { x: 1820, y: 300, r: 10 },
      { x: 2080, y: 230, r: 10 },
      { x: 2470, y: 340, r: 10 },
      { x: 2660, y: 270, r: 10 },
      { x: 3140, y: 360, r: 10 },
    ],
    enemies: [
      { x: 670, y: 468, w: 34, h: 32, vx: -1.2, left: 560, right: 980 },
      { x: 1710, y: 468, w: 34, h: 32, vx: 1.15, left: 1200, right: 1930 },
      { x: 2910, y: 468, w: 34, h: 32, vx: -1.35, left: 2840, right: 3510 },
    ],
  },
  {
    name: "1-2",
    worldWidth: 3900,
    spawn: { x: 80, y: 220 },
    flag: { x: 3740, y: 280, w: 20, h: 220 },
    platforms: [
      { x: 0, y: 500, w: 830, h: 60, type: "ground" },
      { x: 940, y: 500, w: 740, h: 60, type: "ground" },
      { x: 1760, y: 500, w: 560, h: 60, type: "ground" },
      { x: 2380, y: 500, w: 700, h: 60, type: "ground" },
      { x: 3160, y: 500, w: 740, h: 60, type: "ground" },
      { x: 290, y: 430, w: 120, h: 24, type: "bonus" },
      { x: 520, y: 370, w: 120, h: 24, type: "brick" },
      { x: 740, y: 315, w: 120, h: 24, type: "power" },
      { x: 1210, y: 410, w: 120, h: 24, type: "brick" },
      { x: 1400, y: 345, w: 120, h: 24, type: "bonus" },
      { x: 1620, y: 285, w: 120, h: 24, type: "brick" },
      { x: 2010, y: 410, w: 120, h: 24, type: "power" },
      { x: 2200, y: 340, w: 120, h: 24, type: "brick" },
      { x: 2570, y: 370, w: 120, h: 24, type: "bonus" },
      { x: 2780, y: 300, w: 120, h: 24, type: "brick" },
      { x: 3280, y: 420, w: 120, h: 24, type: "bonus" },
      { x: 3500, y: 355, w: 120, h: 24, type: "brick" },
    ],
    coins: [
      { x: 320, y: 390, r: 10 },
      { x: 550, y: 330, r: 10 },
      { x: 780, y: 275, r: 10 },
      { x: 1240, y: 370, r: 10 },
      { x: 1440, y: 305, r: 10 },
      { x: 1650, y: 245, r: 10 },
      { x: 2040, y: 370, r: 10 },
      { x: 2230, y: 300, r: 10 },
      { x: 2600, y: 330, r: 10 },
      { x: 2810, y: 260, r: 10 },
      { x: 3310, y: 380, r: 10 },
      { x: 3530, y: 315, r: 10 },
    ],
    enemies: [
      { x: 580, y: 468, w: 34, h: 32, vx: -1.25, left: 140, right: 770 },
      { x: 1320, y: 468, w: 34, h: 32, vx: 1.15, left: 980, right: 1660 },
      { x: 2480, y: 468, w: 34, h: 32, vx: -1.4, left: 2410, right: 3040 },
      { x: 3440, y: 468, w: 34, h: 32, vx: 1.25, left: 3200, right: 3870 },
    ],
  },
  {
    name: "1-3",
    worldWidth: 4200,
    spawn: { x: 80, y: 220 },
    flag: { x: 4040, y: 260, w: 20, h: 240 },
    platforms: [
      { x: 0, y: 500, w: 850, h: 60, type: "ground" },
      { x: 940, y: 500, w: 680, h: 60, type: "ground" },
      { x: 1700, y: 500, w: 520, h: 60, type: "ground" },
      { x: 2290, y: 500, w: 560, h: 60, type: "ground" },
      { x: 2920, y: 500, w: 600, h: 60, type: "ground" },
      { x: 3590, y: 500, w: 620, h: 60, type: "ground" },
      { x: 260, y: 430, w: 120, h: 24, type: "brick" },
      { x: 500, y: 360, w: 120, h: 24, type: "power" },
      { x: 730, y: 290, w: 120, h: 24, type: "brick" },
      { x: 1160, y: 405, w: 120, h: 24, type: "bonus" },
      { x: 1380, y: 330, w: 120, h: 24, type: "brick" },
      { x: 1870, y: 410, w: 120, h: 24, type: "bonus" },
      { x: 2070, y: 345, w: 120, h: 24, type: "brick" },
      { x: 2480, y: 390, w: 120, h: 24, type: "power" },
      { x: 2680, y: 320, w: 120, h: 24, type: "brick" },
      { x: 3120, y: 390, w: 120, h: 24, type: "bonus" },
      { x: 3330, y: 315, w: 120, h: 24, type: "brick" },
      { x: 3760, y: 390, w: 120, h: 24, type: "bonus" },
    ],
    coins: [
      { x: 290, y: 390, r: 10 },
      { x: 530, y: 320, r: 10 },
      { x: 760, y: 250, r: 10 },
      { x: 1190, y: 365, r: 10 },
      { x: 1410, y: 290, r: 10 },
      { x: 1900, y: 370, r: 10 },
      { x: 2100, y: 305, r: 10 },
      { x: 2510, y: 350, r: 10 },
      { x: 2710, y: 280, r: 10 },
      { x: 3150, y: 350, r: 10 },
      { x: 3360, y: 275, r: 10 },
      { x: 3790, y: 350, r: 10 },
    ],
    enemies: [
      { x: 620, y: 468, w: 34, h: 32, vx: -1.2, left: 100, right: 810 },
      { x: 1510, y: 468, w: 34, h: 32, vx: 1.3, left: 980, right: 1640 },
      { x: 2370, y: 468, w: 34, h: 32, vx: -1.45, left: 2310, right: 2830 },
      { x: 3040, y: 468, w: 34, h: 32, vx: 1.32, left: 2950, right: 3510 },
      { x: 3900, y: 468, w: 34, h: 32, vx: -1.5, left: 3620, right: 4150 },
    ],
  },
];

let currentLevel = null;
let platforms = [];
let coins = [];
let enemies = [];
let flowers = [];
let flag = null;
let worldWidth = 3600;

function cloneLevel(level) {
  return {
    name: level.name,
    worldWidth: level.worldWidth,
    spawn: { ...level.spawn, y: level.spawn.y + LEVEL_Y_SHIFT },
    flag: { ...level.flag, y: level.flag.y + LEVEL_Y_SHIFT },
    platforms: level.platforms.map((p) => ({ ...p, y: p.y + LEVEL_Y_SHIFT, used: false, bump: 0 })),
    coins: level.coins.map((c) => ({ ...c, y: c.y + LEVEL_Y_SHIFT, taken: false })),
    enemies: level.enemies.map((e) => ({ ...e, y: e.y + LEVEL_Y_SHIFT, alive: true })),
  };
}

function setOverlay(visible, titleText, subtitleText, buttonText) {
  if (!visible) {
    startScreenEl.classList.remove("show");
    return;
  }

  startScreenEl.classList.add("show");
  const title = startScreenEl.querySelector("h1");
  const subtitle = startScreenEl.querySelector("p");
  title.textContent = titleText;
  subtitle.textContent = subtitleText;
  startBtn.textContent = buttonText;
}

function syncHud() {
  coinsEl.textContent = String(gameState.totalCoins);
  livesEl.textContent = String(player.lives);
  levelEl.textContent = levels[gameState.levelIndex].name;
}

function resetPlayerPosition() {
  player.x = currentLevel.spawn.x;
  player.y = currentLevel.spawn.y;
  player.vx = 0;
  player.vy = 0;
  player.onGround = false;
  player.jumpLatch = false;
  gameState.cameraX = Math.max(0, player.x - 220);
}

function loadCurrentLevel() {
  currentLevel = cloneLevel(levels[gameState.levelIndex]);
  platforms = currentLevel.platforms;
  coins = currentLevel.coins;
  enemies = currentLevel.enemies;
  flowers = [];
  flag = currentLevel.flag;
  worldWidth = currentLevel.worldWidth;
  resetPlayerPosition();
  syncHud();
  messageEl.textContent = "Doidi do flaga. Zheltye i oranzhevye bloki dayut usileniya.";
}

function startNewGame() {
  gameState.levelIndex = 0;
  gameState.totalCoins = 0;
  gameState.mode = "playing";
  player.lives = 3;
  player.speedBoostFrames = 0;
  player.speedBoostTier = 0;
  loadCurrentLevel();
  setOverlay(false);
}

function intersects(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function handleInput() {
  const boosted = player.speedBoostFrames > 0;
  const tierMultiplier = player.speedBoostTier === 2 ? 1.2 : 1;
  const currentMaxSpeed = boosted ? BOOST_MAX_SPEED * tierMultiplier : BASE_MAX_SPEED;
  const currentAccel = boosted ? BOOST_ACCEL * tierMultiplier : BASE_ACCEL;

  if (keys.left) {
    player.vx -= currentAccel;
    player.facing = -1;
  }
  if (keys.right) {
    player.vx += currentAccel;
    player.facing = 1;
  }

  if (keys.jump && player.onGround && !player.jumpLatch) {
    player.vy = JUMP_SPEED;
    player.onGround = false;
    player.jumpLatch = true;
  }

  if (!keys.jump) {
    player.jumpLatch = false;
  }

  if (player.vx > currentMaxSpeed) player.vx = currentMaxSpeed;
  if (player.vx < -currentMaxSpeed) player.vx = -currentMaxSpeed;
}

function spawnFlower(block) {
  flowers.push({
    x: block.x + block.w / 2 - 14,
    y: block.y - 28,
    w: 28,
    h: 28,
    vx: 1.05,
    isSuper: block.type === "power",
    left: Math.max(0, block.x - 120),
    right: Math.min(worldWidth, block.x + 120),
    taken: false,
  });
}

function updatePlayer() {
  handleInput();

  player.vy += GRAVITY;
  player.vx *= player.speedBoostFrames > 0 ? BOOST_FRICTION : BASE_FRICTION;

  player.x += player.vx;
  if (player.x < 0) {
    player.x = 0;
    player.vx = 0;
  }
  if (player.x + player.w > worldWidth) {
    player.x = worldWidth - player.w;
    player.vx = 0;
  }

  player.y += player.vy;
  player.onGround = false;

  for (const p of platforms) {
    const blockRect = { x: p.x, y: p.y + p.bump, w: p.w, h: p.h };
    if (!intersects(player, blockRect)) continue;

    const prevBottom = player.y + player.h - player.vy;
    const prevTop = player.y - player.vy;
    const prevRight = player.x + player.w - player.vx;
    const prevLeft = player.x - player.vx;

    if (prevBottom <= blockRect.y) {
      player.y = blockRect.y - player.h;
      player.vy = 0;
      player.onGround = true;
      continue;
    }

    if (prevTop >= blockRect.y + blockRect.h) {
      player.y = blockRect.y + blockRect.h;
      player.vy = 0.2;

      if ((p.type === "bonus" || p.type === "power") && !p.used) {
        p.used = true;
        p.bump = -8;
        spawnFlower(p);
      }
      continue;
    }

    if (prevRight <= blockRect.x) {
      player.x = blockRect.x - player.w;
      player.vx = 0;
      continue;
    }

    if (prevLeft >= blockRect.x + blockRect.w) {
      player.x = blockRect.x + blockRect.w;
      player.vx = 0;
    }
  }

  if (player.y > canvas.height + 180) {
    loseLife();
  }
}

function updateBonusBlocks() {
  for (const p of platforms) {
    if (p.bump < 0) {
      p.bump += 1.4;
      if (p.bump > 0) p.bump = 0;
    }
  }
}

function updateCoins() {
  for (const c of coins) {
    if (c.taken) continue;
    const hit = intersects(player, { x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 });
    if (!hit) continue;
    c.taken = true;
    gameState.totalCoins += 1;
    syncHud();
  }
}

function loseLife() {
  if (gameState.mode !== "playing") return;

  player.lives -= 1;
  player.speedBoostFrames = 0;
  player.speedBoostTier = 0;
  syncHud();

  if (player.lives <= 0) {
    gameState.mode = "gameover";
    messageEl.textContent = "Game over. Nazhmi Enter ili knopku Start.";
    setOverlay(true, "GAME OVER", `Monet sobrano: ${gameState.totalCoins}`, "Try Again");
    return;
  }

  messageEl.textContent = "Ty poteryal zhizn. Prodolzhaem!";
  resetPlayerPosition();
}

function updateEnemies() {
  for (const e of enemies) {
    if (!e.alive) continue;

    e.x += e.vx;
    if (e.x < e.left || e.x + e.w > e.right) e.vx *= -1;

    if (!intersects(player, e)) continue;

    const stomp = player.vy > 0 && player.y + player.h - player.vy <= e.y + 6;
    if (stomp) {
      e.alive = false;
      player.vy = -8.2;
      continue;
    }

    loseLife();
    return;
  }
}

function updateFlowers() {
  for (const f of flowers) {
    if (f.taken) continue;

    f.x += f.vx;
    if (f.x < f.left || f.x + f.w > f.right) f.vx *= -1;

    if (!intersects(player, f)) continue;
    f.taken = true;
    player.speedBoostFrames = Math.max(player.speedBoostFrames, f.isSuper ? BOOST_DURATION + 6 * 60 : BOOST_DURATION);
    player.speedBoostTier = Math.max(player.speedBoostTier, f.isSuper ? 2 : 1);
    messageEl.textContent = f.isSuper
      ? "Super-cvetok! Maksimalnoe uskorenie aktivno."
      : "Cvetok uskoreniya! Ty zametno bystree.";
  }

  flowers = flowers.filter((f) => !f.taken);
}

function updateFlag() {
  const flagBody = { x: flag.x - 12, y: flag.y, w: 36, h: flag.h };
  if (!intersects(player, flagBody)) return;

  gameState.levelIndex += 1;
  if (gameState.levelIndex < levels.length) {
    messageEl.textContent = `Uroven proiden! Zagruzka ${levels[gameState.levelIndex].name}...`;
    loadCurrentLevel();
    return;
  }

  gameState.mode = "victory";
  messageEl.textContent = "Ty proshyol vse urovni!";
  setOverlay(true, "POBEDA", `Monet: ${gameState.totalCoins}. Urovney: ${levels.length}.`, "Play Again");
}

function updateCamera() {
  const target = player.x - canvas.width * 0.35;
  gameState.cameraX += (target - gameState.cameraX) * 0.12;
  gameState.cameraX = Math.max(0, Math.min(gameState.cameraX, worldWidth - canvas.width));
}

function drawPixelClouds() {
  const cloudColor = "#ffffff";
  const cloudShade = "#dceeff";
  for (let i = 0; i < 6; i += 1) {
    const x = i * 240 + 30 - (gameState.cameraX * 0.2) % 240;
    const y = 60 + (i % 3) * 30;
    ctx.fillStyle = cloudColor;
    ctx.fillRect(Math.round(x), y, 80, 20);
    ctx.fillRect(Math.round(x + 12), y - 10, 56, 10);
    ctx.fillStyle = cloudShade;
    ctx.fillRect(Math.round(x + 6), y + 20, 66, 6);
  }
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#76b4ff");
  sky.addColorStop(1, "#dff4ff");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawPixelClouds();

  for (let i = 0; i < 10; i += 1) {
    const x = i * 420 - (gameState.cameraX * 0.4) % 420;
    const baseY = canvas.height;
    const topY = 395 - ((i * 31) % 90);
    ctx.fillStyle = i % 2 === 0 ? "#5ab86b" : "#46a65c";
    ctx.beginPath();
    ctx.moveTo(x, baseY);
    ctx.lineTo(x + 90, topY);
    ctx.lineTo(x + 190, baseY);
    ctx.closePath();
    ctx.fill();
  }
}

function drawPlatform(p) {
  const y = p.y + p.bump;

  if (p.type === "ground") {
    ctx.fillStyle = "#8f5a35";
    ctx.fillRect(p.x, y, p.w, p.h);
    ctx.fillStyle = "#6f4326";
    for (let x = p.x; x < p.x + p.w; x += 16) {
      ctx.fillRect(x, y + 6, 12, 4);
    }
    return;
  }

  if (p.type === "bonus") {
    ctx.fillStyle = p.used ? "#9e8152" : "#f5c851";
    ctx.fillRect(p.x, y, p.w, p.h);
    ctx.strokeStyle = p.used ? "#7f6642" : "#bf8e1a";
    ctx.lineWidth = 3;
    ctx.strokeRect(p.x + 1, y + 1, p.w - 2, p.h - 2);
    if (!p.used) {
      ctx.fillStyle = "#bf8e1a";
      ctx.fillRect(p.x + p.w / 2 - 5, y + 6, 10, 12);
      ctx.fillRect(p.x + p.w / 2 - 2, y + 17, 4, 3);
    }
    return;
  }

  if (p.type === "power") {
    ctx.fillStyle = p.used ? "#8f6b58" : "#f08b35";
    ctx.fillRect(p.x, y, p.w, p.h);
    ctx.strokeStyle = p.used ? "#6f5346" : "#b3561a";
    ctx.lineWidth = 3;
    ctx.strokeRect(p.x + 1, y + 1, p.w - 2, p.h - 2);
    if (!p.used) {
      ctx.fillStyle = "#ffe0b5";
      ctx.fillRect(p.x + p.w / 2 - 6, y + 5, 12, 12);
      ctx.fillStyle = "#b3561a";
      ctx.fillRect(p.x + p.w / 2 - 2, y + 17, 4, 3);
    }
    return;
  }

  ctx.fillStyle = "#bd7447";
  ctx.fillRect(p.x, y, p.w, p.h);
  ctx.strokeStyle = "#8a4e2b";
  ctx.lineWidth = 2;
  ctx.strokeRect(p.x + 1, y + 1, p.w - 2, p.h - 2);
}

function drawCoins() {
  for (const c of coins) {
    if (c.taken) continue;
    ctx.fillStyle = "#ffd43a";
    ctx.fillRect(c.x - 8, c.y - 10, 16, 20);
    ctx.fillStyle = "#ffef9f";
    ctx.fillRect(c.x - 4, c.y - 8, 3, 16);
    ctx.fillRect(c.x + 1, c.y - 8, 3, 16);
  }
}

function drawEnemy(e) {
  ctx.fillStyle = "#6e3718";
  ctx.fillRect(e.x, e.y, e.w, e.h);
  ctx.fillStyle = "#e6cbab";
  ctx.fillRect(e.x + 4, e.y + 20, e.w - 8, 8);
  ctx.fillStyle = "#111";
  ctx.fillRect(e.x + 8, e.y + 8, 4, 4);
  ctx.fillRect(e.x + e.w - 12, e.y + 8, 4, 4);
}

function drawFlower(f) {
  ctx.fillStyle = "#2b9d46";
  ctx.fillRect(f.x + 12, f.y + 14, 4, 14);
  ctx.fillRect(f.x + 8, f.y + 18, 4, 4);
  ctx.fillRect(f.x + 16, f.y + 18, 4, 4);
  ctx.fillStyle = f.isSuper ? "#ff9c2f" : "#f45f37";
  ctx.fillRect(f.x + 6, f.y + 3, 16, 12);
  ctx.fillStyle = f.isSuper ? "#fff3b8" : "#ffe9d6";
  ctx.fillRect(f.x + 9, f.y + 6, 3, 3);
  ctx.fillRect(f.x + 16, f.y + 6, 3, 3);
}

function drawPlayer() {
  const isRunning = player.onGround && Math.abs(player.vx) > 1.2;
  const isStanding = player.onGround && Math.abs(player.vx) <= 1.2;
  const drawW = player.w * PLAYER_PNG_SCALE;
  const drawH = player.h * PLAYER_PNG_SCALE;
  const drawX = player.x - (drawW - player.w) / 2;
  const drawY = player.y - (drawH - player.h);

  if (isStanding && sproutStandingReady) {
    ctx.save();
    if (player.facing === -1) {
      ctx.translate(drawX + drawW, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(sproutStandingImg, 0, 0, sproutStandingImg.width, sproutStandingImg.height, 0, drawY, drawW, drawH);
    } else {
      ctx.drawImage(
        sproutStandingImg,
        0,
        0,
        sproutStandingImg.width,
        sproutStandingImg.height,
        drawX,
        drawY,
        drawW,
        drawH
      );
    }
    ctx.restore();
    return;
  }

  if (isRunning && sproutRunningReady) {
    ctx.save();
    if (player.facing === -1) {
      ctx.translate(drawX + drawW, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(sproutRunningImg, 0, 0, sproutRunningImg.width, sproutRunningImg.height, 0, drawY, drawW, drawH);
    } else {
      ctx.drawImage(
        sproutRunningImg,
        0,
        0,
        sproutRunningImg.width,
        sproutRunningImg.height,
        drawX,
        drawY,
        drawW,
        drawH
      );
    }
    ctx.restore();
    return;
  }

  ctx.fillStyle = "#d4372f";
  ctx.fillRect(player.x + 6, player.y, player.w - 12, 14);

  ctx.fillStyle = player.speedBoostFrames > 0 ? "#55de5d" : "#2f5dcf";
  ctx.fillRect(player.x + 4, player.y + 14, player.w - 8, player.h - 14);

  ctx.fillStyle = "#f3d3b3";
  ctx.fillRect(player.x + 8, player.y + 12, player.w - 16, 14);

  const eyeX = player.facing === 1 ? player.x + player.w - 12 : player.x + 8;
  ctx.fillStyle = "#000";
  ctx.fillRect(eyeX, player.y + 16, 4, 4);

  const runOffset = (Math.sign(player.vx) || 1) * Math.min(3, Math.abs(player.vx));
  ctx.fillStyle = "#6d3c1f";
  ctx.fillRect(player.x + 6, player.y + player.h - 7, 9, 7 + runOffset);
  ctx.fillRect(player.x + player.w - 15, player.y + player.h - 7, 9, 7 - runOffset);
}

function drawFlag() {
  ctx.fillStyle = "#eceff4";
  ctx.fillRect(flag.x, flag.y, flag.w, flag.h);
  ctx.fillStyle = "#33b34a";
  ctx.fillRect(flag.x + flag.w, flag.y + 12, 56, 14);
  ctx.fillRect(flag.x + flag.w + 10, flag.y + 26, 40, 12);
}

function drawBoostGauge() {
  if (player.speedBoostFrames <= 0) return;

  const ratio = player.speedBoostFrames / BOOST_DURATION;
  ctx.fillStyle = "#11203d";
  ctx.fillRect(20, 20, 180, 16);
  ctx.fillStyle = player.speedBoostTier === 2 ? "#ffad33" : "#4fd467";
  ctx.fillRect(22, 22, 176 * ratio, 12);
  ctx.fillStyle = "#f9fcff";
  ctx.font = "12px 'Press Start 2P', monospace";
  ctx.fillText(player.speedBoostTier === 2 ? "BOOST+" : "BOOST", 210, 33);
}

function draw() {
  drawBackground();

  ctx.save();
  ctx.translate(-gameState.cameraX, 0);

  for (const p of platforms) drawPlatform(p);
  drawCoins();

  for (const e of enemies) {
    if (e.alive) drawEnemy(e);
  }

  for (const f of flowers) drawFlower(f);

  drawFlag();
  drawPlayer();

  ctx.restore();
  drawBoostGauge();
}

function tickPlaying() {
  updatePlayer();
  updateBonusBlocks();
  updateCoins();
  updateEnemies();
  updateFlowers();
  updateFlag();
  updateCamera();

  if (player.speedBoostFrames > 0) {
    player.speedBoostFrames -= 1;
    if (player.speedBoostFrames === 0) {
      player.speedBoostTier = 0;
      messageEl.textContent = "Uskorenie zakonchilos.";
    }
  }
}

function gameLoop() {
  gameState.frame += 1;
  if (gameState.mode === "playing") {
    tickPlaying();
  }

  draw();
  requestAnimationFrame(gameLoop);
}

function handleStartAction() {
  if (gameState.mode === "start" || gameState.mode === "gameover" || gameState.mode === "victory") {
    startNewGame();
  }
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (_error) {
    messageEl.textContent = "Brauzer ne razreshil fullscreen.";
  }
}

function syncFullscreenButton() {
  fullscreenBtn.textContent = document.fullscreenElement ? "Window" : "Fullscreen";
}

window.addEventListener("keydown", (e) => {
  const k = e.key.toLowerCase();

  if (k === "a" || e.key === "ArrowLeft") keys.left = true;
  if (k === "d" || e.key === "ArrowRight") keys.right = true;
  if (k === "w" || e.key === "ArrowUp" || e.key === " ") keys.jump = true;

  if (k === "r") {
    startNewGame();
  }

  if (e.key === "Enter") {
    handleStartAction();
  }

  if (k === "f") {
    toggleFullscreen();
  }
});

window.addEventListener("keyup", (e) => {
  const k = e.key.toLowerCase();

  if (k === "a" || e.key === "ArrowLeft") keys.left = false;
  if (k === "d" || e.key === "ArrowRight") keys.right = false;
  if (k === "w" || e.key === "ArrowUp" || e.key === " ") keys.jump = false;
});

startBtn.addEventListener("click", handleStartAction);
fullscreenBtn.addEventListener("click", toggleFullscreen);
document.addEventListener("fullscreenchange", syncFullscreenButton);

startNewGame();
syncFullscreenButton();
gameLoop();
