const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const DIFFICULTY_ORDER = ['easy', 'medium', 'hard'];

const skinOptions = [
    { name: 'Default', src: 'looey.png' },
    { name: 'Skin 1', src: 'looeySKIN1.png' },
    { name: 'Skin 2', src: 'looeySKIN2.png' }
];
const playerSkins = skinOptions.map(option => {
    const image = new Image();
    image.src = option.src;
    return image;
});
let selectedSkinIndexP1 = 0;
let selectedSkinIndexP2 = 0;
let selectedSkinIndexP3 = 0;

// Enemy sprites used only on easy difficulty
const easyEnemyPoppyImage = new Image();
easyEnemyPoppyImage.src = 'poppy.png';

const easyEnemyBoxtenImage = new Image();
easyEnemyBoxtenImage.src = 'boxten.png';

// Enemy sprite used only on medium difficulty
const mediumEnemyImage = new Image();
mediumEnemyImage.src = 'pebble.png';

const mediumEnemySproutImage = new Image();
mediumEnemySproutImage.src = 'sprout.png';

// Enemy sprite used only on hard difficulty
const hardEnemyImage = new Image();
hardEnemyImage.src = 'dyle.png';

const hardEnemyDandyImage = new Image();
hardEnemyDandyImage.src = 'dandy.png';

let keysPressed = {};
let lastTime = 0;
let gameState = 'menu'; // 'menu', 'difficultyMenu', 'skins', 'levelIntro', 'playing', 'gameOver'
let selectedDifficulty = null;
let menuNotice = '';
let selectedPlayerCount = 2;

const difficulties = {
    easy: {
        enemySpeed: 80,
        spawnInterval: 4,
        scalingRate: 0.05
    },
    medium: {
        enemySpeed: 100,
        spawnInterval: 3,
        scalingRate: 0.1
    },
    hard: {
        enemySpeed: 130,
        spawnInterval: 2,
        scalingRate: 0.15
    }
};

let currentDifficultyConfig = difficulties.medium;

const skinsButton = { x: 280, y: 455, width: 240, height: 55 };
const backButton = { x: 280, y: 540, width: 240, height: 45 };
const playerCountButtons = [
    { players: 1, x: 220, y: 250, width: 360, height: 60 },
    { players: 2, x: 220, y: 325, width: 360, height: 60 },
    { players: 3, x: 220, y: 400, width: 360, height: 60 }
];
const difficultyButtons = [
    { difficulty: 'easy', label: '1 - EASY', color: '#90EE90', x: 280, y: 250, width: 240, height: 60 },
    { difficulty: 'medium', label: '2 - MEDIUM', color: '#FFD700', x: 280, y: 330, width: 240, height: 60 },
    { difficulty: 'hard', label: '3 - HARD', color: '#FF6B6B', x: 280, y: 410, width: 240, height: 60 }
];

function getSkinButtonRect(index) {
    return getSkinButtonRectForPlayer(index, 1);
}

function getSkinButtonRectForPlayer(index, playerNumber) {
    const width = 170;
    const height = 140;
    const spacing = 25;
    const totalWidth = width * 3 + spacing * 2;
    const startX = CANVAS_WIDTH / 2 - totalWidth / 2;
    const x = startX + index * (width + spacing);
    const y = playerNumber === 1 ? 140 : playerNumber === 2 ? 300 : 460;
    return { x, y, width, height };
}

function isPointInRect(px, py, rect) {
    return px >= rect.x && px <= rect.x + rect.width && py >= rect.y && py <= rect.y + rect.height;
}

function setSkinForPlayer(playerNumber, index) {
    const clamped = Math.max(0, Math.min(index, skinOptions.length - 1));
    if (playerNumber === 1) {
        selectedSkinIndexP1 = clamped;
    } else if (playerNumber === 2) {
        selectedSkinIndexP2 = clamped;
    } else {
        selectedSkinIndexP3 = clamped;
    }
}

function getCurrentPlayerImage(playerNumber) {
    if (playerNumber === 1) {
        return playerSkins[selectedSkinIndexP1];
    }
    if (playerNumber === 2) {
        return playerSkins[selectedSkinIndexP2];
    }
    return playerSkins[selectedSkinIndexP3];
}

function openSkinsMenu() {
    gameState = 'skins';
}

function openDifficultyMenu(playerCount) {
    selectedPlayerCount = playerCount;
    gameState = 'difficultyMenu';
}

function getNextDifficulty(current) {
    const currentIndex = DIFFICULTY_ORDER.indexOf(current);
    if (currentIndex === -1 || currentIndex >= DIFFICULTY_ORDER.length - 1) {
        return null;
    }
    return DIFFICULTY_ORDER[currentIndex + 1];
}

function advanceToNextLevel() {
    const nextDifficulty = getNextDifficulty(selectedDifficulty);
    if (!nextDifficulty) {
        menuNotice = 'All levels completed!';
        goToMenu();
        return;
    }

    menuNotice = `Advanced to ${nextDifficulty.toUpperCase()}!`;
    startGame(nextDifficulty);
}

document.addEventListener('keydown', (e) => {
    keysPressed[e.key] = true;
    keysPressed[e.code] = true;
    
    // Menu selection
    if (gameState === 'menu') {
        if (e.key === '1') {
            openDifficultyMenu(1);
        } else if (e.key === '2') {
            openDifficultyMenu(2);
        } else if (e.key === '3') {
            openDifficultyMenu(3);
        } else if (e.key === '4') {
            openSkinsMenu();
        }
    }

    if (gameState === 'difficultyMenu') {
        if (e.key === '1') {
            startGame('easy');
        } else if (e.key === '2') {
            startGame('medium');
        } else if (e.key === '3') {
            startGame('hard');
        } else if (e.key.toLowerCase() === 'b' || e.key === 'Escape') {
            gameState = 'menu';
        }
    }

    if (gameState === 'skins') {
        if (e.key === '1') {
            setSkinForPlayer(1, 0);
        } else if (e.key === '2') {
            setSkinForPlayer(1, 1);
        } else if (e.key === '3') {
            setSkinForPlayer(1, 2);
        } else if (e.key.toLowerCase() === 'j') {
            setSkinForPlayer(2, 0);
        } else if (e.key.toLowerCase() === 'k') {
            setSkinForPlayer(2, 1);
        } else if (e.key.toLowerCase() === 'l') {
            setSkinForPlayer(2, 2);
        } else if (e.key === '4') {
            setSkinForPlayer(3, 0);
        } else if (e.key === '5') {
            setSkinForPlayer(3, 1);
        } else if (e.key === '6') {
            setSkinForPlayer(3, 2);
        } else if (e.key.toLowerCase() === 'b' || e.key === 'Escape') {
            gameState = 'menu';
        }
    }
    
    // Restart on game over
    if (gameState === 'gameOver' && e.key.toLowerCase() === 'r') {
        goToMenu();
    }
});

document.addEventListener('keyup', (e) => {
    keysPressed[e.key] = false;
    keysPressed[e.code] = false;
});

canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    if (gameState === 'menu') {
        for (let button of playerCountButtons) {
            if (isPointInRect(clickX, clickY, button)) {
                openDifficultyMenu(button.players);
                return;
            }
        }

        if (isPointInRect(clickX, clickY, skinsButton)) {
            openSkinsMenu();
        }
        return;
    }

    if (gameState === 'difficultyMenu') {
        for (let button of difficultyButtons) {
            if (isPointInRect(clickX, clickY, button)) {
                startGame(button.difficulty);
                return;
            }
        }

        if (isPointInRect(clickX, clickY, backButton)) {
            gameState = 'menu';
        }
        return;
    }

    if (gameState === 'skins') {
        for (let i = 0; i < skinOptions.length; i++) {
            if (isPointInRect(clickX, clickY, getSkinButtonRectForPlayer(i, 1))) {
                setSkinForPlayer(1, i);
                return;
            }
            if (isPointInRect(clickX, clickY, getSkinButtonRectForPlayer(i, 2))) {
                setSkinForPlayer(2, i);
                return;
            }
            if (isPointInRect(clickX, clickY, getSkinButtonRectForPlayer(i, 3))) {
                setSkinForPlayer(3, i);
                return;
            }
        }

        if (isPointInRect(clickX, clickY, backButton)) {
            gameState = 'menu';
        }
    }
});

const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 36;
const SPEED = 200;
const SPRINT_MULTIPLIER = 1.6;
const PLAYER_STAMINA_MAX = 100;
const PLAYER_STAMINA_DRAIN = 34;
const PLAYER_STAMINA_RECOVERY = 22;
const ENEMY_RADIUS = 18;
const LEVEL_INTRO_DURATION = 1.8;
const PLAYER_START_LIVES = 3;
const PLAYER_INVULNERABILITY_TIME = 1.2;
const GENERATOR_SIZE = 32;
const GENERATOR_INTERACT_RADIUS = 55;
const MIN_SPAWN_INTERVAL = 0.5;
const HIGH_SCORE_KEY = 'canvas_apocalypse_highscore';

function getGeneratorCountForDifficulty(difficultyName) {
    if (difficultyName === 'medium') return 6;
    if (difficultyName === 'hard') return 8;
    return 4;
}

function createGenerators(difficultyName = 'easy') {
    const count = getGeneratorCountForDifficulty(difficultyName);
    const template = [
        { x: 110, y: 110 },
        { x: CANVAS_WIDTH - 110, y: 110 },
        { x: 110, y: CANVAS_HEIGHT - 110 },
        { x: CANVAS_WIDTH - 110, y: CANVAS_HEIGHT - 110 },
        { x: CANVAS_WIDTH / 2, y: 110 },
        { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT - 110 },
        { x: 110, y: CANVAS_HEIGHT / 2 },
        { x: CANVAS_WIDTH - 110, y: CANVAS_HEIGHT / 2 }
    ];

    return template.slice(0, count).map(point => ({
        x: point.x,
        y: point.y,
        size: GENERATOR_SIZE,
        completed: false
    }));
}

function getHighScore() {
    const stored = localStorage.getItem(HIGH_SCORE_KEY);
    return stored ? parseInt(stored, 10) : 0;
}

function saveHighScore(score) {
    localStorage.setItem(HIGH_SCORE_KEY, Math.floor(score));
}

function updateHighScoreIfNeeded(score) {
    const currentHigh = getHighScore();
    if (Math.floor(score) > currentHigh) {
        saveHighScore(Math.floor(score));
        return true; // New high score!
    }
    return false;
}

function spawnExplosion(x, y, particleCount = 30) {
    // Spawn particles at collision point
    for (let i = 0; i < particleCount; i++) {
        const angle = (Math.random() * Math.PI * 2);
        const speed = 150 + Math.random() * 150;
        const particle = {
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 0.8, // Will decay to 0
            color: `hsl(${Math.random() * 60 + 10}, 100%, 50%)` // Orange to red hues
        };
        state.particles.push(particle);
    }
    
    // Trigger screen shake
    state.screenShakeDuration = 0.2; // 200ms
    state.screenShakeAmount = 8; // Pixel offset
}

function updateParticles(deltaTime) {
    for (let i = state.particles.length - 1; i >= 0; i--) {
        const p = state.particles[i];
        p.life -= deltaTime * 1.25; // Decay over time
        
        // First 0.1s: apply velocity, then coast
        if (p.life > 0.7) {
            p.x += p.vx * deltaTime;
            p.y += p.vy * deltaTime;
        } else {
            // Slow deceleration
            p.vx *= 0.95;
            p.vy *= 0.95;
            p.x += p.vx * deltaTime;
            p.y += p.vy * deltaTime;
        }
        
        // Remove dead particles
        if (p.life <= 0) {
            state.particles.splice(i, 1);
        }
    }
    
    // Update screen shake
    if (state.screenShakeDuration > 0) {
        state.screenShakeDuration -= deltaTime;
    }
}

const state = {
    player: {
        x: CANVAS_WIDTH / 2 - PLAYER_SIZE - 20,
        y: CANVAS_HEIGHT / 2 - PLAYER_SIZE / 2,
        width: PLAYER_SIZE,
        height: PLAYER_SIZE,
        color: 'green',
        lives: PLAYER_START_LIVES,
        alive: true,
        invulnerableTimer: 0,
        stamina: PLAYER_STAMINA_MAX,
        isSprinting: false
    },
    player2: {
        x: CANVAS_WIDTH / 2 + 20,
        y: CANVAS_HEIGHT / 2 - PLAYER_SIZE / 2,
        width: PLAYER_SIZE,
        height: PLAYER_SIZE,
        color: 'blue',
        lives: PLAYER_START_LIVES,
        alive: true,
        invulnerableTimer: 0,
        stamina: PLAYER_STAMINA_MAX,
        isSprinting: false
    },
    player3: {
        x: CANVAS_WIDTH / 2 - PLAYER_SIZE / 2,
        y: CANVAS_HEIGHT / 2 + PLAYER_SIZE,
        width: PLAYER_SIZE,
        height: PLAYER_SIZE,
        color: '#ffa500',
        lives: PLAYER_START_LIVES,
        alive: false,
        invulnerableTimer: 0,
        stamina: PLAYER_STAMINA_MAX,
        isSprinting: false
    },
    generators: createGenerators('easy'),
    enemies: [],
    particles: [],
    spawnTimer: 0,
    score: 0,
    timer: 0,
    difficulty: 0,
    screenShakeDuration: 0,
    screenShakeAmount: 0,
    playerAlive: true
};

let levelIntroTimer = 0;

function getAllPlayers() {
    return [state.player, state.player2, state.player3];
}

function getActivePlayers() {
    return getAllPlayers().slice(0, selectedPlayerCount);
}

function setStartingPositions() {
    const centerX = CANVAS_WIDTH / 2 - PLAYER_SIZE / 2;
    const centerY = CANVAS_HEIGHT / 2 - PLAYER_SIZE / 2;

    if (selectedPlayerCount === 1) {
        state.player.x = centerX;
        state.player.y = centerY;
        return;
    }

    if (selectedPlayerCount === 2) {
        state.player.x = CANVAS_WIDTH / 2 - PLAYER_SIZE - 20;
        state.player.y = centerY;
        state.player2.x = CANVAS_WIDTH / 2 + 20;
        state.player2.y = centerY;
        return;
    }

    state.player.x = CANVAS_WIDTH / 2 - PLAYER_SIZE - 40;
    state.player.y = CANVAS_HEIGHT / 2 - PLAYER_SIZE / 2 - 25;
    state.player2.x = CANVAS_WIDTH / 2 + 30;
    state.player2.y = CANVAS_HEIGHT / 2 - PLAYER_SIZE / 2 - 25;
    state.player3.x = CANVAS_WIDTH / 2 - PLAYER_SIZE / 2;
    state.player3.y = CANVAS_HEIGHT / 2 + 30;
}

function getRespawnPosition(playerIndex) {
    const centerX = CANVAS_WIDTH / 2 - PLAYER_SIZE / 2;
    const centerY = CANVAS_HEIGHT / 2 - PLAYER_SIZE / 2;

    if (selectedPlayerCount === 1) {
        return { x: centerX, y: centerY };
    }

    if (selectedPlayerCount === 2) {
        return playerIndex === 0
            ? { x: CANVAS_WIDTH / 2 - PLAYER_SIZE - 20, y: centerY }
            : { x: CANVAS_WIDTH / 2 + 20, y: centerY };
    }

    if (playerIndex === 0) {
        return { x: CANVAS_WIDTH / 2 - PLAYER_SIZE - 40, y: CANVAS_HEIGHT / 2 - PLAYER_SIZE / 2 - 25 };
    }
    if (playerIndex === 1) {
        return { x: CANVAS_WIDTH / 2 + 30, y: CANVAS_HEIGHT / 2 - PLAYER_SIZE / 2 - 25 };
    }
    return { x: CANVAS_WIDTH / 2 - PLAYER_SIZE / 2, y: CANVAS_HEIGHT / 2 + 30 };
}

function spawnEnemy() {
    const side = Math.floor(Math.random() * 4);
    let x, y;
    if (side === 0) { // top
        x = Math.random() * CANVAS_WIDTH;
        y = 0;
    } else if (side === 1) { // right
        x = CANVAS_WIDTH;
        y = Math.random() * CANVAS_HEIGHT;
    } else if (side === 2) { // bottom
        x = Math.random() * CANVAS_WIDTH;
        y = CANVAS_HEIGHT;
    } else { // left
        x = 0;
        y = Math.random() * CANVAS_HEIGHT;
    }
    const enemy = {
        x: x,
        y: y,
        radius: ENEMY_RADIUS,
        color: 'red',
        easyType: selectedDifficulty === 'easy' ? (Math.random() < 0.5 ? 'poppy' : 'boxten') : null,
        mediumType: selectedDifficulty === 'medium' ? (Math.random() < 0.5 ? 'pebble' : 'sprout') : null,
        hardType: selectedDifficulty === 'hard' ? (Math.random() < 0.5 ? 'dyle' : 'dandy') : null
    };
    state.enemies.push(enemy);
}

function isColliding(player, enemy) {
    // Circle-rectangle collision
    const cx = enemy.x;
    const cy = enemy.y;
    const radius = enemy.radius;
    const rx = player.x;
    const ry = player.y;
    const rw = player.width;
    const rh = player.height;

    // Find closest point on rectangle to circle center
    const closestX = Math.max(rx, Math.min(cx, rx + rw));
    const closestY = Math.max(ry, Math.min(cy, ry + rh));

    // Distance from circle center to closest point
    const distX = cx - closestX;
    const distY = cy - closestY;
    const distance = Math.sqrt(distX * distX + distY * distY);

    return distance < radius;
}

function startGame(difficultyName) {
    selectedDifficulty = difficultyName;
    currentDifficultyConfig = difficulties[difficultyName];
    gameState = 'levelIntro';
    levelIntroTimer = LEVEL_INTRO_DURATION;
    
    const allPlayers = getAllPlayers();
    for (let i = 0; i < allPlayers.length; i++) {
        const player = allPlayers[i];
        player.lives = PLAYER_START_LIVES;
        player.alive = i < selectedPlayerCount;
        player.invulnerableTimer = 0;
        player.stamina = PLAYER_STAMINA_MAX;
        player.isSprinting = false;
    }

    setStartingPositions();
    state.generators = createGenerators(difficultyName);
    state.enemies = [];
    state.particles = [];
    state.spawnTimer = 0;
    state.score = 0;
    state.timer = 0;
    state.difficulty = 0;
    state.screenShakeDuration = 0;
    state.screenShakeAmount = 0;
    state.playerAlive = true;
    
    spawnEnemy();
}

function goToMenu() {
    gameState = 'menu';
    selectedDifficulty = null;
    // Update high score before returning to menu
    updateHighScoreIfNeeded(state.score);
}

function getAlivePlayers() {
    return getActivePlayers().filter(player => player.alive);
}

function getClosestPlayer(enemy) {
    const players = getAlivePlayers();
    if (players.length === 0) {
        return null;
    }

    let closest = players[0];
    let closestDistance = Infinity;

    for (let player of players) {
        const centerX = player.x + player.width / 2;
        const centerY = player.y + player.height / 2;
        const dx = centerX - enemy.x;
        const dy = centerY - enemy.y;
        const distanceSq = dx * dx + dy * dy;

        if (distanceSq < closestDistance) {
            closestDistance = distanceSq;
            closest = player;
        }
    }

    return closest;
}

function getPlayerCenter(player) {
    return {
        x: player.x + player.width / 2,
        y: player.y + player.height / 2
    };
}

function tryCompleteGenerators(player, actionPressed) {
    if (!player.alive || !actionPressed) {
        return;
    }

    const center = getPlayerCenter(player);
    for (let generator of state.generators) {
        if (generator.completed) {
            continue;
        }

        const dx = generator.x - center.x;
        const dy = generator.y - center.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= GENERATOR_INTERACT_RADIUS) {
            generator.completed = true;
            break;
        }
    }
}

function damagePlayer(player, respawnX, respawnY) {
    player.lives -= 1;
    player.invulnerableTimer = PLAYER_INVULNERABILITY_TIME;

    if (player.lives <= 0) {
        player.alive = false;
        return;
    }

    player.x = respawnX;
    player.y = respawnY;
}

function movePlayer(player, dx, dy, deltaTime, speedMultiplier = 1) {
    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
        dx *= 0.707;
        dy *= 0.707;
    }

    player.x += dx * SPEED * speedMultiplier * deltaTime;
    player.y += dy * SPEED * speedMultiplier * deltaTime;

    // Clamp to bounds
    player.x = Math.max(0, Math.min(CANVAS_WIDTH - player.width, player.x));
    player.y = Math.max(0, Math.min(CANVAS_HEIGHT - player.height, player.y));
}

function update(deltaTime) {
    // Update particles and screen shake always (for death animation)
    updateParticles(deltaTime);

    if (gameState === 'levelIntro') {
        levelIntroTimer -= deltaTime;
        if (levelIntroTimer <= 0) {
            gameState = 'playing';
        }
        return;
    }
    
    if (gameState !== 'playing') {
        return;
    }

    state.player.invulnerableTimer = Math.max(0, state.player.invulnerableTimer - deltaTime);
    state.player2.invulnerableTimer = Math.max(0, state.player2.invulnerableTimer - deltaTime);
    state.player3.invulnerableTimer = Math.max(0, state.player3.invulnerableTimer - deltaTime);
    
    let p1dx = 0;
    let p1dy = 0;
    let p2dx = 0;
    let p2dy = 0;
    let p3dx = 0;
    let p3dy = 0;
    const keys = Object.keys(keysPressed).filter(k => keysPressed[k]);
    // Player 1 controls: WASD
    if (keys.includes('w') || keys.includes('W')) p1dy -= 1;
    if (keys.includes('s') || keys.includes('S')) p1dy += 1;
    if (keys.includes('a') || keys.includes('A')) p1dx -= 1;
    if (keys.includes('d') || keys.includes('D')) p1dx += 1;

    // Player 2 controls: Arrow keys
    if (keys.includes('ArrowUp')) p2dy -= 1;
    if (keys.includes('ArrowDown')) p2dy += 1;
    if (keys.includes('ArrowLeft')) p2dx -= 1;
    if (keys.includes('ArrowRight')) p2dx += 1;

    // Player 3 controls: U H J K
    if (keys.includes('u') || keys.includes('U')) p3dy -= 1;
    if (keys.includes('j') || keys.includes('J')) p3dy += 1;
    if (keys.includes('h') || keys.includes('H')) p3dx -= 1;
    if (keys.includes('k') || keys.includes('K')) p3dx += 1;

    const p1Moving = p1dx !== 0 || p1dy !== 0;
    const p2Moving = p2dx !== 0 || p2dy !== 0;
    const p3Moving = p3dx !== 0 || p3dy !== 0;
    const p1SprintHeld = keys.includes('ShiftLeft') || keys.includes('Shift');
    const p2SprintHeld = keys.includes('ShiftRight');

    state.player.isSprinting = state.player.alive && p1Moving && p1SprintHeld && state.player.stamina > 0;
    state.player2.isSprinting = state.player2.alive && p2Moving && p2SprintHeld && state.player2.stamina > 0;
    state.player3.isSprinting = false;

    if (state.player.alive) {
        if (state.player.isSprinting) {
            state.player.stamina = Math.max(0, state.player.stamina - PLAYER_STAMINA_DRAIN * deltaTime);
        } else {
            state.player.stamina = Math.min(PLAYER_STAMINA_MAX, state.player.stamina + PLAYER_STAMINA_RECOVERY * deltaTime);
        }
    }

    if (state.player2.alive) {
        if (state.player2.isSprinting) {
            state.player2.stamina = Math.max(0, state.player2.stamina - PLAYER_STAMINA_DRAIN * deltaTime);
        } else {
            state.player2.stamina = Math.min(PLAYER_STAMINA_MAX, state.player2.stamina + PLAYER_STAMINA_RECOVERY * deltaTime);
        }
    }

    if (state.player3.alive) {
        if (p3Moving) {
            state.player3.stamina = Math.max(0, state.player3.stamina - PLAYER_STAMINA_DRAIN * 0.15 * deltaTime);
        } else {
            state.player3.stamina = Math.min(PLAYER_STAMINA_MAX, state.player3.stamina + PLAYER_STAMINA_RECOVERY * deltaTime);
        }
    }

    if (state.player.alive) {
        movePlayer(state.player, p1dx, p1dy, deltaTime, state.player.isSprinting ? SPRINT_MULTIPLIER : 1);
    }
    if (state.player2.alive) {
        movePlayer(state.player2, p2dx, p2dy, deltaTime, state.player2.isSprinting ? SPRINT_MULTIPLIER : 1);
    }
    if (state.player3.alive) {
        movePlayer(state.player3, p3dx, p3dy, deltaTime, 1);
    }

    tryCompleteGenerators(state.player, keys.includes('e') || keys.includes('E'));
    tryCompleteGenerators(state.player2, keys.includes('Enter'));
    tryCompleteGenerators(state.player3, keys.includes('i') || keys.includes('I'));

    const completedGenerators = state.generators.filter(generator => generator.completed).length;
    if (completedGenerators === state.generators.length) {
        advanceToNextLevel();
        return;
    }

    // Enemy movement - speed increases with difficulty
    const currentEnemySpeed = currentDifficultyConfig.enemySpeed * (1 + state.difficulty);
    for (let enemy of state.enemies) {
        const targetPlayer = getClosestPlayer(enemy);
        if (!targetPlayer) {
            continue;
        }

        const edx = (targetPlayer.x + targetPlayer.width / 2) - enemy.x;
        const edy = (targetPlayer.y + targetPlayer.height / 2) - enemy.y;
        const distance = Math.sqrt(edx * edx + edy * edy);
        if (distance > 0) {
            const nx = edx / distance;
            const ny = edy / distance;
            enemy.x += nx * currentEnemySpeed * deltaTime;
            enemy.y += ny * currentEnemySpeed * deltaTime;
        }
    }

    // Current spawn interval decreases with difficulty (minimum cap)
    const currentSpawnInterval = Math.max(MIN_SPAWN_INTERVAL, currentDifficultyConfig.spawnInterval - state.difficulty * 0.5);
    state.spawnTimer += deltaTime;
    if (state.spawnTimer >= currentSpawnInterval) {
        spawnEnemy();
        state.spawnTimer = 0;
    }

    // Check collision with players (1 life lost per player per frame)
    const activePlayers = getActivePlayers();
    for (let i = 0; i < activePlayers.length; i++) {
        const player = activePlayers[i];
        if (!player.alive || player.invulnerableTimer > 0) {
            continue;
        }

        const hitEnemy = state.enemies.find(enemy => isColliding(player, enemy));
        if (!hitEnemy) {
            continue;
        }

        const center = getPlayerCenter(player);
        spawnExplosion(center.x, center.y, 60);
        const respawn = getRespawnPosition(i);
        damagePlayer(player, respawn.x, respawn.y);
        state.enemies = state.enemies.filter(enemy => enemy !== hitEnemy);
    }

    if (getAlivePlayers().length === 0) {
        state.playerAlive = false;
        gameState = 'gameOver';
    }

    // Increase difficulty over time
    state.difficulty += currentDifficultyConfig.scalingRate * deltaTime;

    // Update timer and score
    state.timer += deltaTime;
    state.score += deltaTime * 10;
}

function draw() {
    // Clear canvas with transparency
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (gameState === 'menu') {
        drawMenu();
    } else if (gameState === 'difficultyMenu') {
        drawDifficultyMenu();
    } else if (gameState === 'skins') {
        drawSkinsMenu();
    } else if (gameState === 'levelIntro') {
        drawLevelIntro();
    } else if (gameState === 'gameOver') {
        drawGameOver();
    } else {
        drawGame();
    }
}

function drawDifficultyMenu() {
    ctx.fillStyle = '#141414';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.font = 'bold 46px Arial';
    ctx.fillText('SELECT DIFFICULTY', CANVAS_WIDTH / 2, 110);

    ctx.font = '24px Arial';
    ctx.fillText(`Players: ${selectedPlayerCount}`, CANVAS_WIDTH / 2, 150);

    for (let button of difficultyButtons) {
        ctx.fillStyle = button.color;
        ctx.fillRect(button.x, button.y, button.width, button.height);
        ctx.fillStyle = 'black';
        ctx.font = 'bold 24px Arial';
        ctx.fillText(button.label, button.x + button.width / 2, button.y + 40);
    }

    ctx.fillStyle = '#444';
    ctx.fillRect(backButton.x, backButton.y, backButton.width, backButton.height);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 24px Arial';
    ctx.fillText('B - BACK', CANVAS_WIDTH / 2, backButton.y + 36);
}

function drawLevelIntro() {
    drawGame();

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.font = 'bold 52px Arial';
    ctx.fillText(`LEVEL: ${selectedDifficulty ? selectedDifficulty.toUpperCase() : ''}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);

    ctx.font = '24px Arial';
    ctx.fillText(`Generators: ${state.generators.length}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 28);
}

function drawSkinsMenu() {
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.fillStyle = 'white';
    ctx.font = 'bold 44px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('SKINS', CANVAS_WIDTH / 2, 70);

    ctx.font = '20px Arial';
    ctx.fillText('P1: 1/2/3   P2: J/K/L   P3: 4/5/6', CANVAS_WIDTH / 2, 100);

    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#9be7ff';
    ctx.fillText('PLAYER 1', CANVAS_WIDTH / 2, 130);

    for (let i = 0; i < skinOptions.length; i++) {
        const box = getSkinButtonRectForPlayer(i, 1);
        const isSelected = i === selectedSkinIndexP1;
        const image = playerSkins[i];

        ctx.fillStyle = isSelected ? '#2c3e50' : '#1a1a1a';
        ctx.fillRect(box.x, box.y, box.width, box.height);
        ctx.strokeStyle = isSelected ? '#4dd2ff' : '#666';
        ctx.lineWidth = isSelected ? 4 : 2;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        const previewSize = 64;
        const previewX = box.x + box.width / 2 - previewSize / 2;
        const previewY = box.y + 22;
        if (image.complete && image.naturalWidth > 0) {
            ctx.drawImage(image, previewX, previewY, previewSize, previewSize);
        } else {
            ctx.fillStyle = '#555';
            ctx.fillRect(previewX, previewY, previewSize, previewSize);
        }

        ctx.fillStyle = 'white';
        ctx.font = 'bold 20px Arial';
        ctx.fillText(`${i + 1}`, box.x + box.width / 2, box.y + 106);
        ctx.font = '16px Arial';
        ctx.fillText(skinOptions[i].name, box.x + box.width / 2, box.y + 128);
    }

    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#ffd39b';
    ctx.fillText('PLAYER 2', CANVAS_WIDTH / 2, 290);

    for (let i = 0; i < skinOptions.length; i++) {
        const box = getSkinButtonRectForPlayer(i, 2);
        const isSelected = i === selectedSkinIndexP2;
        const image = playerSkins[i];

        ctx.fillStyle = isSelected ? '#4a3520' : '#1a1a1a';
        ctx.fillRect(box.x, box.y, box.width, box.height);
        ctx.strokeStyle = isSelected ? '#ffb347' : '#666';
        ctx.lineWidth = isSelected ? 4 : 2;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        const previewSize = 64;
        const previewX = box.x + box.width / 2 - previewSize / 2;
        const previewY = box.y + 22;
        if (image.complete && image.naturalWidth > 0) {
            ctx.drawImage(image, previewX, previewY, previewSize, previewSize);
        } else {
            ctx.fillStyle = '#555';
            ctx.fillRect(previewX, previewY, previewSize, previewSize);
        }

        ctx.fillStyle = 'white';
        ctx.font = 'bold 20px Arial';
        const keyLabel = i === 0 ? 'J' : i === 1 ? 'K' : 'L';
        ctx.fillText(keyLabel, box.x + box.width / 2, box.y + 106);
        ctx.font = '16px Arial';
        ctx.fillText(skinOptions[i].name, box.x + box.width / 2, box.y + 128);
    }

    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#b7ffb1';
    ctx.fillText('PLAYER 3', CANVAS_WIDTH / 2, 450);

    for (let i = 0; i < skinOptions.length; i++) {
        const box = getSkinButtonRectForPlayer(i, 3);
        const isSelected = i === selectedSkinIndexP3;
        const image = playerSkins[i];

        ctx.fillStyle = isSelected ? '#214027' : '#1a1a1a';
        ctx.fillRect(box.x, box.y, box.width, box.height);
        ctx.strokeStyle = isSelected ? '#7CFC00' : '#666';
        ctx.lineWidth = isSelected ? 4 : 2;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        const previewSize = 64;
        const previewX = box.x + box.width / 2 - previewSize / 2;
        const previewY = box.y + 22;
        if (image.complete && image.naturalWidth > 0) {
            ctx.drawImage(image, previewX, previewY, previewSize, previewSize);
        } else {
            ctx.fillStyle = '#555';
            ctx.fillRect(previewX, previewY, previewSize, previewSize);
        }

        ctx.fillStyle = 'white';
        ctx.font = 'bold 20px Arial';
        const keyLabel = `${i + 4}`;
        ctx.fillText(keyLabel, box.x + box.width / 2, box.y + 106);
        ctx.font = '16px Arial';
        ctx.fillText(skinOptions[i].name, box.x + box.width / 2, box.y + 128);
    }

    ctx.fillStyle = '#404040';
    ctx.fillRect(backButton.x, 540, backButton.width, 45);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 20px Arial';
    ctx.fillText('B - BACK', CANVAS_WIDTH / 2, 570);
}

function drawBackground() {
    // Subtle animated grid overlay on room background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
    const dotSize = 2;
    const dotSpacing = 40;
    const offset = (state.timer * 20) % dotSpacing;
    
    for (let x = -offset; x < CANVAS_WIDTH; x += dotSpacing) {
        for (let y = 0; y < CANVAS_HEIGHT; y += dotSpacing) {
            ctx.fillRect(x, y, dotSize, dotSize);
        }
    }
}

function drawParticles() {
    for (let particle of state.particles) {
        ctx.globalAlpha = particle.life; // Fade based on life
        ctx.fillStyle = particle.color;
        ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1.0; // Reset alpha
}

function drawGenerators() {
    for (let generator of state.generators) {
        ctx.fillStyle = generator.completed ? '#2ecc71' : '#e74c3c';
        ctx.fillRect(generator.x - generator.size / 2, generator.y - generator.size / 2, generator.size, generator.size);

        ctx.strokeStyle = generator.completed ? '#baf7d0' : '#ffb3a9';
        ctx.lineWidth = 2;
        ctx.strokeRect(generator.x - generator.size / 2, generator.y - generator.size / 2, generator.size, generator.size);
    }
}

function getScreenShakeOffset() {
    if (state.screenShakeDuration <= 0) {
        return { x: 0, y: 0 };
    }
    return {
        x: (Math.random() - 0.5) * state.screenShakeAmount,
        y: (Math.random() - 0.5) * state.screenShakeAmount
    };
}

function drawEnemy(enemy) {
    const isEasyMode = selectedDifficulty === 'easy';
    const isMediumMode = selectedDifficulty === 'medium';
    const isHardMode = selectedDifficulty === 'hard';
    const easyPoppyReady = easyEnemyPoppyImage.complete && easyEnemyPoppyImage.naturalWidth > 0;
    const easyBoxtenReady = easyEnemyBoxtenImage.complete && easyEnemyBoxtenImage.naturalWidth > 0;
    const mediumPebbleReady = mediumEnemyImage.complete && mediumEnemyImage.naturalWidth > 0;
    const mediumSproutReady = mediumEnemySproutImage.complete && mediumEnemySproutImage.naturalWidth > 0;
    const hardDyleReady = hardEnemyImage.complete && hardEnemyImage.naturalWidth > 0;
    const hardDandyReady = hardEnemyDandyImage.complete && hardEnemyDandyImage.naturalWidth > 0;

    if (isEasyMode) {
        const useBoxten = enemy.easyType === 'boxten';
        const selectedImage = useBoxten ? easyEnemyBoxtenImage : easyEnemyPoppyImage;
        const imageReady = useBoxten ? easyBoxtenReady : easyPoppyReady;

        if (!imageReady) {
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        const size = enemy.radius * 2;
        ctx.drawImage(selectedImage, enemy.x - size / 2, enemy.y - size / 2, size, size);
        return;
    }

    if (isMediumMode) {
        const useSprout = enemy.mediumType === 'sprout';
        const selectedImage = useSprout ? mediumEnemySproutImage : mediumEnemyImage;
        const imageReady = useSprout ? mediumSproutReady : mediumPebbleReady;

        if (!imageReady) {
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        const size = enemy.radius * 3;
        ctx.drawImage(selectedImage, enemy.x - size / 2, enemy.y - size / 2, size, size);
        return;
    }

    if (isHardMode) {
        const useDandy = enemy.hardType === 'dandy';
        const selectedImage = useDandy ? hardEnemyDandyImage : hardEnemyImage;
        const imageReady = useDandy ? hardDandyReady : hardDyleReady;

        if (!imageReady) {
            ctx.beginPath();
            ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        const size = enemy.radius * 3;
        ctx.drawImage(selectedImage, enemy.x - size / 2, enemy.y - size / 2, size, size);
        return;
    }

    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
    ctx.fill();
}

function drawMenu() {
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.fillStyle = 'white';
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BROWSER GAME', CANVAS_WIDTH / 2, 100);
    
    // Display high score
    ctx.font = '20px Arial';
    const highScore = getHighScore();
    ctx.fillText(`High Score: ${highScore}`, CANVAS_WIDTH / 2, 145);
    
    ctx.font = '32px Arial';
    ctx.fillText('How Many Players?', CANVAS_WIDTH / 2, 205);

    ctx.font = 'bold 24px Arial';
    for (let button of playerCountButtons) {
        ctx.fillStyle = '#8a8a8a';
        ctx.fillRect(button.x, button.y, button.width, button.height);
        ctx.fillStyle = 'black';
        ctx.fillText(`${button.players} PLAYER${button.players > 1 ? 'S' : ''}`, CANVAS_WIDTH / 2, button.y + 40);
    }

    ctx.fillStyle = '#5DADE2';
    ctx.fillRect(skinsButton.x, skinsButton.y, skinsButton.width, skinsButton.height);
    ctx.fillStyle = 'black';
    ctx.fillText('4 - SKINS', CANVAS_WIDTH / 2, skinsButton.y + 37);

    if (menuNotice) {
        ctx.fillStyle = '#9be7a2';
        ctx.font = '20px Arial';
        ctx.fillText(menuNotice, CANVAS_WIDTH / 2, 225);
    }

    ctx.fillStyle = 'white';
    ctx.font = '18px Arial';
    ctx.fillText('P1: WASD + E + Shift', CANVAS_WIDTH / 2, 532);
    ctx.fillText('P2: Arrows + Enter + Right Shift', CANVAS_WIDTH / 2, 553);
    ctx.fillText('P3: U H J K + I', CANVAS_WIDTH / 2, 574);
}

function drawGameOver() {
    // Draw background (room visible behind)
    drawBackground();
    
    const shake = getScreenShakeOffset();
    ctx.save();
    ctx.translate(shake.x, shake.y);

    drawGenerators();
    
    // Draw players only if still alive
    const activePlayers = getActivePlayers();
    for (let i = 0; i < activePlayers.length; i++) {
        const player = activePlayers[i];
        if (!player.alive) {
            continue;
        }

        const image = getCurrentPlayerImage(i + 1);
        if (image.complete && image.naturalWidth > 0) {
            ctx.drawImage(image, player.x, player.y, player.width, player.height);
        } else {
            ctx.fillStyle = player.color;
            ctx.fillRect(player.x, player.y, player.width, player.height);
        }
    }
    
    // Draw enemies (frozen)
    ctx.fillStyle = 'red';
    for (let enemy of state.enemies) {
        drawEnemy(enemy);
    }
    ctx.restore();
    
    // Draw particles (death animation)
    drawParticles();
    
    // Draw semi-transparent overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Draw game over text
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.font = '48px Arial';
    ctx.fillText('GAME OVER', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 65);
    
    ctx.font = '28px Arial';
    const finalScore = Math.floor(state.score);
    const highScore = getHighScore();
    const isNewHighScore = finalScore > highScore;
    
    ctx.fillText(`Final Score: ${finalScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    
    if (isNewHighScore) {
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 24px Arial';
        ctx.fillText('NEW HIGH SCORE!', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
    }
    
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText(`High Score: ${highScore}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 80);
    ctx.fillText(`Time Survived: ${state.timer.toFixed(1)}s`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 110);
    ctx.fillText('Press R to return to menu', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 150);
    
    ctx.font = '16px Arial';
    ctx.fillText('P1: WASD + E + Shift', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 188);
    ctx.fillText('P2: Arrows + Enter + Right Shift', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 210);
    ctx.fillText('P3: U H J K + I', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 232);
}

function drawGame() {
    // Background is shown through transparent canvas (from background.svg)
    
    // Draw subtle overlay grid (optional effect)
    drawBackground();
    
    // Get screen shake offset
    const shake = getScreenShakeOffset();
    
    // Draw players with screen shake
    ctx.save();
    ctx.translate(shake.x, shake.y);

    drawGenerators();

    const activePlayers = getActivePlayers();
    for (let i = 0; i < activePlayers.length; i++) {
        const player = activePlayers[i];
        if (!player.alive) {
            continue;
        }

        const image = getCurrentPlayerImage(i + 1);
        ctx.globalAlpha = player.invulnerableTimer > 0 ? 0.6 : 1;
        if (image.complete && image.naturalWidth > 0) {
            ctx.drawImage(image, player.x, player.y, player.width, player.height);
        } else {
            ctx.fillStyle = player.color;
            ctx.fillRect(player.x, player.y, player.width, player.height);
        }
    }
    ctx.globalAlpha = 1;

    // Draw all enemies with screen shake
    ctx.fillStyle = 'red';
    for (let enemy of state.enemies) {
        drawEnemy(enemy);
    }
    ctx.restore();
    
    // Draw particles (no screen shake for particles - they're floating)
    drawParticles();

    // Display survival time, score, and difficulty
    ctx.fillStyle = 'white';
    ctx.font = '24px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Time: ${state.timer.toFixed(1)}s`, 20, 50);
    ctx.fillText(`Score: ${Math.floor(state.score)}`, 20, 80);
    ctx.fillText(`Difficulty: ${state.difficulty.toFixed(1)}x`, 20, 110);
    const completedGenerators = state.generators.filter(generator => generator.completed).length;
    ctx.fillText(`Generators: ${completedGenerators}/${state.generators.length}`, 20, 140);
    const activePlayersForHud = getActivePlayers();
    for (let i = 0; i < activePlayersForHud.length; i++) {
        ctx.fillText(`P${i + 1} Lives: ${Math.max(0, activePlayersForHud[i].lives)}`, 20, 170 + i * 30);
    }

    const barWidth = 170;
    const barHeight = 12;
    const p1Ratio = state.player.stamina / PLAYER_STAMINA_MAX;
    const p2Ratio = state.player2.stamina / PLAYER_STAMINA_MAX;

    ctx.font = '18px Arial';
    ctx.fillStyle = 'white';
    ctx.fillText('P1 Stamina', 20, 260);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(20, 268, barWidth, barHeight);
    ctx.fillStyle = state.player.isSprinting ? '#4dd2ff' : '#8fd98f';
    ctx.fillRect(20, 268, barWidth * p1Ratio, barHeight);

    if (selectedPlayerCount >= 2) {
        ctx.fillStyle = 'white';
        ctx.fillText('P2 Stamina', 20, 300);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(20, 308, barWidth, barHeight);
        ctx.fillStyle = state.player2.isSprinting ? '#4dd2ff' : '#8fd98f';
        ctx.fillRect(20, 308, barWidth * p2Ratio, barHeight);
    }
}

function gameLoop(currentTime) {
    const deltaTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    update(deltaTime);
    draw();
    requestAnimationFrame(gameLoop);
}

lastTime = performance.now();
requestAnimationFrame(gameLoop);