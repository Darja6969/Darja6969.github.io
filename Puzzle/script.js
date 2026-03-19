// Main game controller: owns UI references, state, and all gameplay flows.
class PixelPuzzle {
    constructor() {
        // Core board and visual elements.
        this.gameBoard = document.getElementById("gameBoard");
        this.storage = document.getElementById("storage");
        this.ghostLayer = document.getElementById("ghostLayer");
        this.imagePreview = document.getElementById("imagePreview");
        this.cameraPreview = document.getElementById("cameraPreview");
        this.movesDisplay = document.getElementById("moves");
        this.timerDisplay = document.getElementById("timer");
        this.successBanner = document.getElementById("successBanner");
        this.fireworksCanvas = document.getElementById("fireworksCanvas");
        this.downloadRecordsBtn = document.getElementById("downloadRecordsBtn");
        this.currentRecord = document.getElementById("currentRecord");
        this.leaderboardList = document.getElementById("leaderboardList");

        // Action controls.
        this.photoInput = document.getElementById("photoInput");
        this.uploadBtn = document.getElementById("uploadBtn");
        this.cameraBtn = document.getElementById("cameraBtn");
        this.captureBtn = document.getElementById("captureBtn");
        this.cutBtn = document.getElementById("cutBtn");
        this.ghostBtn = document.getElementById("ghostBtn");
        this.newGameBtn = document.getElementById("newGameBtn");
        this.resetBtn = document.getElementById("resetBtn");
        this.musicToggle = document.getElementById("musicToggle");

        // Select inputs.
        this.difficultySelect = document.getElementById("difficultySelect");
        this.shapeSelect = document.getElementById("shapeSelect");
        this.musicSelect = document.getElementById("musicSelect");

        // Runtime puzzle state.
        this.grid = Number(this.difficultySelect.value);
        this.imageSrc = "";
        this.moves = 0;
        this.elapsedMs = 0;
        this.startTime = null;
        this.timerId = null;
        this.draggedPiece = null;
        this.isGhostVisible = false;
        this.pieceSize = 0;
        this.boardPixels = 0;
        this.pieces = [];
        this.cameraStream = null;
        // Snap radius coefficient relative to piece size.
        this.snapThresholdFactor = 0.34;

        // Audio and music state.
        this.musicEnabled = false;
        this.audioCtx = null;
        this.musicMasterGain = null;
        this.musicLoopId = null;
        this.activeMusicOscillators = [];

        // Persisted performance records loaded from localStorage.
        this.records = this.loadRecords();

        // Initial bootstrapping.
        this.bindEvents();
        this.createEmptyBoard();
        this.resetCounters();
        this.renderRecords();
        this.resizeFireworksCanvas();
        window.addEventListener("resize", () => {
            this.resizeFireworksCanvas();
            this.createEmptyBoard();
        });
    }

    // Wire all UI events to game handlers.
    bindEvents() {
        this.uploadBtn.addEventListener("click", () => this.photoInput.click());
        this.photoInput.addEventListener("change", (e) => this.handleFileUpload(e));
        this.cameraBtn.addEventListener("click", () => this.toggleCamera());
        this.captureBtn.addEventListener("click", () => this.captureFromCamera());
        this.cutBtn.addEventListener("click", () => this.cutIntoPieces());
        this.ghostBtn.addEventListener("click", () => this.toggleGhost());

        this.newGameBtn.addEventListener("click", () => this.newGame());
        this.resetBtn.addEventListener("click", () => this.fullReset());

        this.difficultySelect.addEventListener("change", () => {
            this.grid = Number(this.difficultySelect.value);
            this.createEmptyBoard();
        });

        this.musicToggle.addEventListener("click", () => this.toggleMusic());
        this.musicSelect.addEventListener("change", () => {
            if (this.musicEnabled) {
                this.ensureAudioContext().then(() => this.startMusicLoop());
            }
        });

        this.downloadRecordsBtn.addEventListener("click", () => this.downloadRecordsJson());

        this.gameBoard.addEventListener("dragover", (e) => this.onBoardDragOver(e));
        this.gameBoard.addEventListener("drop", (e) => this.onBoardDrop(e));
        this.storage.addEventListener("dragover", (e) => {
            e.preventDefault();
            this.storage.classList.add("drag-target");
        });
        this.storage.addEventListener("dragleave", () => this.storage.classList.remove("drag-target"));
        this.storage.addEventListener("drop", (e) => this.onStorageDrop(e));
    }

    // Reset moves/time counters and stop timer loop.
    resetCounters() {
        this.moves = 0;
        this.elapsedMs = 0;
        this.startTime = null;
        this.movesDisplay.textContent = "0";
        this.timerDisplay.textContent = "00:00";
        clearInterval(this.timerId);
        this.timerId = null;
    }

    // Start elapsed-time updates only when the user actually moves a piece.
    startTimerOnFirstMove() {
        if (this.startTime !== null) {
            return;
        }

        this.startTime = performance.now();
        this.timerId = setInterval(() => {
            this.elapsedMs = performance.now() - this.startTime;
            this.timerDisplay.textContent = this.formatTime(this.elapsedMs);
        }, 100);
    }

    // Freeze timer and render final elapsed value.
    stopTimer() {
        if (this.startTime !== null) {
            this.elapsedMs = performance.now() - this.startTime;
        }
        clearInterval(this.timerId);
        this.timerId = null;
        this.startTime = null;
        this.timerDisplay.textContent = this.formatTime(this.elapsedMs);
    }

    // Convert milliseconds to MM:SS format.
    formatTime(ms) {
        const total = Math.floor(ms / 1000);
        const minutes = Math.floor(total / 60);
        const seconds = total % 60;
        return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    // Build an empty board grid made of placeholder slots.
    createEmptyBoard() {
        this.gameBoard.innerHTML = "";
        this.gameBoard.style.setProperty("--grid", String(this.grid));

        const boardRect = this.gameBoard.getBoundingClientRect();
        const usable = Math.max(260, Math.min(boardRect.width, boardRect.height));
        this.boardPixels = usable;
        this.pieceSize = this.boardPixels / this.grid;

        for (let i = 0; i < this.grid * this.grid; i += 1) {
            const slot = document.createElement("div");
            slot.className = "board-slot";
            slot.dataset.index = String(i);
            this.gameBoard.appendChild(slot);
        }

        // Keep hint image synchronized with the current source.
        if (this.imageSrc) {
            this.ghostLayer.style.backgroundImage = `url('${this.imageSrc}')`;
        }
    }

    // Read uploaded file and convert it to a data URL image source.
    handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => this.setSourceImage(e.target.result);
        reader.readAsDataURL(file);
    }

    // Start or stop camera stream; retries multiple camera constraints for compatibility.
    async toggleCamera() {
        if (this.cameraStream) {
            this.stopCamera();
            return;
        }

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            alert("Camera API is not available in this browser/context.");
            return;
        }

        try {
            // Ensure stale stream references are fully released before new request.
            this.stopCamera();

            const attempts = [
                {
                    video: {
                        facingMode: { ideal: "environment" },
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                    audio: false,
                },
                {
                    video: {
                        facingMode: { ideal: "user" },
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                    audio: false,
                },
                {
                    video: true,
                    audio: false,
                },
            ];

            let lastError = null;
            for (const constraints of attempts) {
                try {
                    this.cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
                    break;
                } catch (innerError) {
                    lastError = innerError;
                }
            }

            if (!this.cameraStream) {
                throw lastError || new Error("Unable to open camera stream");
            }

            this.cameraPreview.srcObject = this.cameraStream;
            await this.cameraPreview.play();
            this.cameraPreview.classList.add("active");
            this.captureBtn.disabled = false;
            this.cameraBtn.textContent = "Stop Camera";
        } catch (error) {
            const name = error && error.name ? error.name : "UnknownError";
            if (name === "NotReadableError") {
                alert("Camera is busy or blocked by another app/tab. Close other camera apps and retry.");
            } else if (name === "NotAllowedError") {
                alert("Camera permission was denied. Please allow access and retry.");
            } else {
                alert("Camera access failed. Try reloading the page and using HTTP localhost or HTTPS.");
            }
            console.error(error);
            this.stopCamera();
        }
    }

    // Fully release active camera stream and reset preview state.
    stopCamera() {
        if (this.cameraStream) {
            for (const track of this.cameraStream.getTracks()) {
                track.stop();
            }
            this.cameraStream = null;
        }

        this.cameraPreview.pause();
        this.cameraPreview.srcObject = null;
        this.cameraPreview.load();
        this.cameraPreview.classList.remove("active");
        this.captureBtn.disabled = true;
        this.cameraBtn.textContent = "Use Camera";
    }

    // Capture a centered square from video and upscale to a fixed 1200x1200 image.
    captureFromCamera() {
        if (!this.cameraStream || !this.cameraPreview.videoWidth) {
            alert("Camera preview is not ready yet.");
            return;
        }

        const vw = this.cameraPreview.videoWidth;
        const vh = this.cameraPreview.videoHeight;
        const side = Math.min(vw, vh);
        const sx = Math.floor((vw - side) / 2);
        const sy = Math.floor((vh - side) / 2);

        const canvas = document.createElement("canvas");
        canvas.width = 1200;
        canvas.height = 1200;
        const ctx = canvas.getContext("2d");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(this.cameraPreview, sx, sy, side, side, 0, 0, 1200, 1200);

        this.setSourceImage(canvas.toDataURL("image/png"));
        this.stopCamera();
    }

    // Set image as source for preview, cutting, and ghost hint.
    setSourceImage(imageSrc) {
        this.imageSrc = imageSrc;
        this.imagePreview.innerHTML = `<img src="${imageSrc}" alt="Source image">`;
        this.ghostLayer.style.backgroundImage = `url('${imageSrc}')`;
        this.cutBtn.disabled = false;
        this.ghostBtn.disabled = false;
    }

    // Toggle semi-transparent hint layer visibility.
    toggleGhost() {
        this.isGhostVisible = !this.isGhostVisible;
        this.ghostLayer.classList.toggle("visible", this.isGhostVisible);
        this.ghostBtn.textContent = this.isGhostVisible ? "Vaata: On" : "Vaata";
    }

    // Slice source image into pieces and move them into randomized storage.
    cutIntoPieces() {
        if (!this.imageSrc) {
            alert("Upload image or capture from camera first.");
            return;
        }

        this.grid = Number(this.difficultySelect.value);
        this.createEmptyBoard();
        this.storage.innerHTML = "";
        this.pieces = [];
        this.successBanner.classList.remove("visible");
        this.resetCounters();

        const boardRect = this.gameBoard.getBoundingClientRect();
        this.boardPixels = Math.min(boardRect.width, boardRect.height);
        this.pieceSize = this.boardPixels / this.grid;

        const pieces = [];
        let id = 0;
        for (let row = 0; row < this.grid; row += 1) {
            for (let col = 0; col < this.grid; col += 1) {
                const piece = document.createElement("div");
                piece.className = "puzzle-piece";
                piece.draggable = true;
                piece.dataset.id = String(id);
                piece.dataset.row = String(row);
                piece.dataset.col = String(col);
                piece.dataset.correctX = String(col * this.pieceSize);
                piece.dataset.correctY = String(row * this.pieceSize);
                piece.dataset.correctIndex = String(id);
                piece.dataset.currentIndex = "-1";
                piece.dataset.snapped = "false";
                piece.dataset.locked = "false";

                piece.style.width = `${this.pieceSize - 2}px`;
                piece.style.height = `${this.pieceSize - 2}px`;
                piece.style.backgroundImage = `url('${this.imageSrc}')`;
                piece.style.backgroundSize = `${this.boardPixels}px ${this.boardPixels}px`;
                piece.style.backgroundPosition = `${-col * this.pieceSize}px ${-row * this.pieceSize}px`;

                this.applyShape(piece, row, col, id);

                piece.addEventListener("dragstart", (e) => this.onPieceDragStart(e, piece));
                piece.addEventListener("dragend", () => this.onPieceDragEnd(piece));

                pieces.push(piece);
                id += 1;
            }
        }

        this.shuffleArray(pieces);
        for (const piece of pieces) {
            this.storage.appendChild(piece);
        }
        this.pieces = pieces;
    }

    // Apply visual shape mask mode for each piece.
    applyShape(piece, row, col, seed) {
        const mode = this.shapeSelect.value;
        if (mode === "square") {
            piece.style.clipPath = "none";
            return;
        }

        if (mode === "triangle") {
            const even = (row + col) % 2 === 0;
            piece.style.clipPath = even
                ? "polygon(0 0, 100% 0, 0 100%)"
                : "polygon(100% 0, 100% 100%, 0 100%)";
            return;
        }

        const rng = this.seeded(seed + 17);
        const p1 = 10 + Math.floor(rng() * 18);
        const p2 = 78 + Math.floor(rng() * 18);
        const p3 = 72 + Math.floor(rng() * 20);
        const p4 = 64 + Math.floor(rng() * 22);
        const p5 = 12 + Math.floor(rng() * 20);
        const p6 = 26 + Math.floor(rng() * 28);
        piece.style.clipPath = `polygon(${p1}% 0%, ${p2}% 0%, 100% ${p3}%, ${p4}% 100%, ${p5}% 100%, 0% ${p6}%)`;
    }

    // Lightweight deterministic pseudo-random generator used for repeatable polygon shapes.
    seeded(seed) {
        let value = seed;
        return () => {
            value = (value * 9301 + 49297) % 233280;
            return value / 233280;
        };
    }

    // Begin drag operation for a piece unless it is locked in a correct position.
    onPieceDragStart(event, piece) {
        if (piece.dataset.locked === "true") {
            event.preventDefault();
            return;
        }

        this.startTimerOnFirstMove();
        this.draggedPiece = piece;
        piece.classList.add("dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", piece.dataset.id);
    }

    // Cleanup drag-related UI state.
    onPieceDragEnd(piece) {
        piece.classList.remove("dragging");
        this.draggedPiece = null;
        this.clearMagnetHighlight();
        this.storage.classList.remove("drag-target");
    }

    // During drag-over, compute nearest slot and show magnet highlight near correct area.
    onBoardDragOver(event) {
        event.preventDefault();
        if (!this.draggedPiece) {
            return;
        }

        const boardRect = this.gameBoard.getBoundingClientRect();
        const dropCol = Math.max(0, Math.min(this.grid - 1, Math.floor((event.clientX - boardRect.left) / this.pieceSize)));
        const dropRow = Math.max(0, Math.min(this.grid - 1, Math.floor((event.clientY - boardRect.top) / this.pieceSize)));
        const dropX = dropCol * this.pieceSize;
        const dropY = dropRow * this.pieceSize;
        const targetX = Number(this.draggedPiece.dataset.correctX);
        const targetY = Number(this.draggedPiece.dataset.correctY);
        const dist = Math.hypot(dropX - targetX, dropY - targetY);

        this.clearMagnetHighlight();
        if (dist <= this.pieceSize * this.snapThresholdFactor) {
            const index = this.draggedPiece.dataset.correctIndex;
            const slot = this.gameBoard.querySelector(`[data-index="${index}"]`);
            if (slot) {
                slot.classList.add("magnet");
            }
        }
    }

    // Drop handler with snap logic, swap behavior, and locked-piece protection.
    onBoardDrop(event) {
        event.preventDefault();
        if (!this.draggedPiece) {
            return;
        }

        const piece = this.draggedPiece;
        const boardRect = this.gameBoard.getBoundingClientRect();
        const previousIndex = Number(piece.dataset.currentIndex || "-1");

        const dropCol = Math.max(0, Math.min(this.grid - 1, Math.floor((event.clientX - boardRect.left) / this.pieceSize)));
        const dropRow = Math.max(0, Math.min(this.grid - 1, Math.floor((event.clientY - boardRect.top) / this.pieceSize)));
        let dropIndex = dropRow * this.grid + dropCol;

        let x = dropCol * this.pieceSize;
        let y = dropRow * this.pieceSize;

        const targetX = Number(piece.dataset.correctX);
        const targetY = Number(piece.dataset.correctY);
        const dist = Math.hypot(x - targetX, y - targetY);
        const correctIndex = Number(piece.dataset.correctIndex);

        if (dist <= this.pieceSize * this.snapThresholdFactor) {
            dropIndex = correctIndex;
            x = targetX;
            y = targetY;
        }

        const occupiedBy = this.getPieceAtIndex(dropIndex, piece);
        if (occupiedBy) {
            // Locked pieces are magnet-fixed and cannot be displaced.
            if (occupiedBy.dataset.locked === "true") {
                if (previousIndex >= 0) {
                    this.placePieceAtIndex(piece, previousIndex);
                    this.setPieceSnappedByIndex(piece, previousIndex, false);
                } else {
                    piece.style.position = "";
                    piece.style.left = "";
                    piece.style.top = "";
                    piece.style.zIndex = "";
                    piece.dataset.currentIndex = "-1";
                    piece.dataset.locked = "false";
                    piece.classList.remove("locked", "snapped");
                    this.storage.appendChild(piece);
                }
                this.clearMagnetHighlight();
                return;
            }

            if (previousIndex >= 0) {
                // Swap positions when dropping onto another piece already on board.
                this.placePieceAtIndex(occupiedBy, previousIndex);
                this.setPieceSnappedByIndex(occupiedBy, previousIndex, false);
                this.placePieceAtIndex(piece, dropIndex, x, y);
                this.setPieceSnappedByIndex(piece, dropIndex, true);
            } else {
                // If dragged from storage onto occupied cell, move occupant back to storage.
                occupiedBy.style.position = "";
                occupiedBy.style.left = "";
                occupiedBy.style.top = "";
                occupiedBy.style.zIndex = "";
                occupiedBy.dataset.currentIndex = "-1";
                occupiedBy.dataset.snapped = "false";
                occupiedBy.dataset.locked = "false";
                occupiedBy.classList.remove("snapped");
                occupiedBy.classList.remove("locked");
                occupiedBy.draggable = true;
                this.storage.appendChild(occupiedBy);

                this.placePieceAtIndex(piece, dropIndex, x, y);
                this.setPieceSnappedByIndex(piece, dropIndex, true);
            }

            this.moves += 1;
            this.movesDisplay.textContent = String(this.moves);
            this.clearMagnetHighlight();
            this.checkWin();
            return;
        }

        this.placePieceAtIndex(piece, dropIndex, x, y);
        this.setPieceSnappedByIndex(piece, dropIndex, true);

        this.moves += 1;
        this.movesDisplay.textContent = String(this.moves);

        this.clearMagnetHighlight();
        this.checkWin();
    }

    // Return piece back to storage area when dropped there.
    onStorageDrop(event) {
        event.preventDefault();
        this.storage.classList.remove("drag-target");
        if (!this.draggedPiece) {
            return;
        }

        const piece = this.draggedPiece;
        piece.style.position = "";
        piece.style.left = "";
        piece.style.top = "";
        piece.style.zIndex = "";
        piece.dataset.currentIndex = "-1";
        piece.dataset.snapped = "false";
        piece.dataset.locked = "false";
        piece.classList.remove("snapped");
        piece.classList.remove("locked");
        piece.draggable = true;
        this.storage.appendChild(piece);
    }

    // Find piece currently occupying a board index, optionally ignoring one piece.
    getPieceAtIndex(index, exceptPiece = null) {
        for (const p of this.pieces) {
            if (p === exceptPiece) {
                continue;
            }
            if (p.parentElement === this.gameBoard && Number(p.dataset.currentIndex) === index) {
                return p;
            }
        }
        return null;
    }

    // Place a piece at board index (or explicit x/y) using absolute positioning.
    placePieceAtIndex(piece, index, forcedX = null, forcedY = null) {
        const col = index % this.grid;
        const row = Math.floor(index / this.grid);
        const x = forcedX === null ? col * this.pieceSize : forcedX;
        const y = forcedY === null ? row * this.pieceSize : forcedY;

        piece.style.position = "absolute";
        piece.style.left = `${x}px`;
        piece.style.top = `${y}px`;
        piece.style.zIndex = "8";
        piece.dataset.currentIndex = String(index);
        this.gameBoard.appendChild(piece);
    }

    // Mark piece as snapped/locked when placed on its correct index; play sound if newly snapped.
    setPieceSnappedByIndex(piece, index, playSound = false) {
        const wasSnapped = piece.dataset.snapped === "true";
        const isSnapped = Number(piece.dataset.correctIndex) === Number(index);

        piece.dataset.snapped = isSnapped ? "true" : "false";
        piece.dataset.locked = isSnapped ? "true" : "false";
        piece.classList.toggle("snapped", isSnapped);
        piece.classList.toggle("locked", isSnapped);
        piece.draggable = !isSnapped;

        if (playSound && !wasSnapped && isSnapped) {
            this.playSnapSound();
        }
    }

    // Remove temporary magnet classes from all board slots.
    clearMagnetHighlight() {
        const highlighted = this.gameBoard.querySelectorAll(".board-slot.magnet");
        for (const slot of highlighted) {
            slot.classList.remove("magnet");
        }
    }

    // Short synthesized click/chime sound for successful snap.
    playSnapSound() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        const now = this.audioCtx.currentTime;

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(940, now);
        osc.frequency.exponentialRampToValueAtTime(620, now + 0.08);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
        osc.connect(gain).connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.11);
    }

    // Win condition: every piece is on board and coordinates match target coordinates.
    checkWin() {
        if (!this.pieces.length) {
            return;
        }

        for (const piece of this.pieces) {
            if (piece.parentElement !== this.gameBoard) {
                return;
            }

            const x = parseFloat(piece.style.left || "-999");
            const y = parseFloat(piece.style.top || "-999");
            const tx = Number(piece.dataset.correctX);
            const ty = Number(piece.dataset.correctY);
            if (Math.abs(x - tx) > 0.5 || Math.abs(y - ty) > 0.5) {
                return;
            }
        }

        this.finishGame();
    }

    // End-of-game routine: stop timer, show success UI, run effects, and persist record.
    finishGame() {
        this.stopTimer();
        this.successBanner.classList.add("visible");
        setTimeout(() => this.successBanner.classList.remove("visible"), 1800);

        this.launchFireworks();
        this.saveRecord();
    }

    // Particle burst animation on full-screen canvas.
    launchFireworks() {
        const ctx = this.fireworksCanvas.getContext("2d");
        const particles = [];
        const count = 160;
        const cx = this.fireworksCanvas.width / 2;
        const cy = this.fireworksCanvas.height / 2;

        for (let i = 0; i < count; i += 1) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1.5 + Math.random() * 5.5;
            particles.push({
                x: cx,
                y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 80 + Math.random() * 25,
                hue: 140 + Math.random() * 80,
            });
        }

        let frame = 0;
        const tick = () => {
            ctx.clearRect(0, 0, this.fireworksCanvas.width, this.fireworksCanvas.height);
            for (const p of particles) {
                if (p.life <= 0) {
                    continue;
                }
                p.life -= 1;
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.04;
                p.vx *= 0.992;
                p.vy *= 0.992;

                ctx.fillStyle = `hsla(${p.hue}, 100%, 62%, ${Math.max(0, p.life / 100)})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
                ctx.fill();
            }

            frame += 1;
            if (frame < 105) {
                requestAnimationFrame(tick);
            } else {
                ctx.clearRect(0, 0, this.fireworksCanvas.width, this.fireworksCanvas.height);
            }
        };

        tick();
    }

    // Keep fireworks canvas in sync with viewport dimensions.
    resizeFireworksCanvas() {
        this.fireworksCanvas.width = window.innerWidth;
        this.fireworksCanvas.height = window.innerHeight;
    }

    // Lazy-create and resume AudioContext to satisfy browser autoplay restrictions.
    async ensureAudioContext() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            this.musicMasterGain = this.audioCtx.createGain();
            this.musicMasterGain.gain.value = 0.42;
            this.musicMasterGain.connect(this.audioCtx.destination);
        }
        if (this.audioCtx.state === "suspended") {
            await this.audioCtx.resume();
        }
    }

    // Stop music interval and terminate any oscillators still running.
    stopMusicLoop() {
        clearInterval(this.musicLoopId);
        this.musicLoopId = null;

        for (const osc of this.activeMusicOscillators) {
            try {
                osc.stop();
            } catch {
                // Ignore stop errors for already finished nodes.
            }
        }
        this.activeMusicOscillators = [];
    }

    // Toggle background music playback state.
    async toggleMusic() {
        if (!this.musicEnabled) {
            await this.ensureAudioContext();

            if (this.musicSelect.value === "off") {
                this.musicSelect.value = "chill";
            }

            this.musicEnabled = true;
            this.musicToggle.textContent = "Pause";
            this.startMusicLoop();
            return;
        }

        this.musicEnabled = false;
        this.musicToggle.textContent = "Play";
        this.stopMusicLoop();
    }

    // Build looping note scheduler for selected music style.
    startMusicLoop() {
        this.stopMusicLoop();
        if (!this.musicEnabled) {
            return;
        }

        const style = this.musicSelect.value;
        if (style === "off") {
            return;
        }

        const sequences = {
            chill: { notes: [220, 246.94, 293.66, 329.63], beat: 520, type: "triangle", vol: 0.22, duration: 0.42 },
            focus: { notes: [261.63, 329.63, 392.0, 329.63], beat: 360, type: "sine", vol: 0.2, duration: 0.34 },
            arcade: { notes: [392.0, 523.25, 659.25, 783.99], beat: 210, type: "square", vol: 0.14, duration: 0.24 },
        };

        const seq = sequences[style];
        let step = 0;
        this.musicLoopId = setInterval(() => {
            if (!this.musicEnabled || !this.audioCtx) {
                return;
            }

            if (this.audioCtx.state === "suspended") {
                this.audioCtx.resume();
                return;
            }

            const now = this.audioCtx.currentTime;
            const freq = seq.notes[step % seq.notes.length];

            this.playMusicVoice(freq, seq.type, seq.vol, now, seq.duration, 0);

            // Add a second harmonic voice for Chill/Focus so they are clearly audible.
            if (style === "chill" || style === "focus") {
                this.playMusicVoice(freq * 1.5, seq.type, seq.vol * 0.55, now, seq.duration * 0.92, -6);
            }

            step += 1;
        }, seq.beat);
    }

    // Play a single synthesized note voice with a tiny envelope.
    playMusicVoice(freq, type, peakVolume, startTime, duration, detuneCents = 0) {
        if (!this.audioCtx) {
            return;
        }

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        osc.detune.setValueAtTime(detuneCents, startTime);

        gain.gain.setValueAtTime(0.0001, startTime);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.01, peakVolume), startTime + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

        osc.connect(gain).connect(this.musicMasterGain || this.audioCtx.destination);
        osc.start(startTime);
        osc.stop(startTime + duration + 0.02);

        this.activeMusicOscillators.push(osc);
        osc.onended = () => {
            this.activeMusicOscillators = this.activeMusicOscillators.filter((item) => item !== osc);
        };
    }

    // Load stored records from localStorage with safe JSON parsing.
    loadRecords() {
        try {
            const raw = localStorage.getItem("pixelPuzzleRecords");
            if (!raw) {
                return [];
            }
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    // Save current result, keep top 25 by time, refresh UI, and auto-export JSON.
    saveRecord() {
        const entry = {
            difficulty: `${this.grid}x${this.grid}`,
            shape: this.shapeSelect.value,
            moves: this.moves,
            timeMs: Math.floor(this.elapsedMs),
            timeLabel: this.formatTime(this.elapsedMs),
            createdAt: new Date().toISOString(),
        };

        this.records.push(entry);
        this.records.sort((a, b) => a.timeMs - b.timeMs);
        this.records = this.records.slice(0, 25);
        localStorage.setItem("pixelPuzzleRecords", JSON.stringify(this.records));
        this.renderRecords();
        this.downloadRecordsJson(true);
    }

    // Render best record summary and top leaderboard entries.
    renderRecords() {
        if (!this.records.length) {
            this.currentRecord.textContent = "No record yet";
            this.leaderboardList.innerHTML = "";
            return;
        }

        const best = this.records[0];
        this.currentRecord.textContent = `${best.timeLabel} (${best.difficulty}, ${best.shape})`;

        const top = this.records.slice(0, 8);
        this.leaderboardList.innerHTML = top
            .map((item) => `<li>${item.timeLabel} - ${item.difficulty} - ${item.shape}</li>`)
            .join("");
    }

            // Download records as JSON file; auto mode creates and clicks hidden anchor.
    downloadRecordsJson(isAuto = false) {
        if (!this.records.length) {
            return;
        }

        const blob = new Blob([JSON.stringify(this.records, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "pixel-puzzle-records.json";
        if (isAuto) {
            anchor.style.display = "none";
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
        } else {
            anchor.click();
        }
        URL.revokeObjectURL(url);
    }

    // Start a new round using the current source image (if any).
    newGame() {
        if (!this.imageSrc) {
            this.createEmptyBoard();
            this.resetCounters();
            this.storage.innerHTML = "";
            return;
        }
        this.cutIntoPieces();
    }

    // Full reset: clear image, board, controls, timer, and camera stream.
    fullReset() {
        this.stopCamera();
        this.resetCounters();
        this.storage.innerHTML = "";
        this.imageSrc = "";
        this.cutBtn.disabled = true;
        this.ghostBtn.disabled = true;
        this.isGhostVisible = false;
        this.ghostLayer.classList.remove("visible");
        this.imagePreview.innerHTML = "<span>No image selected</span>";
        this.successBanner.classList.remove("visible");
        this.createEmptyBoard();
    }

    // Fisher-Yates shuffle for unbiased random piece order.
    shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }
}

// Boot the app after DOM is fully parsed.
document.addEventListener("DOMContentLoaded", () => {
    new PixelPuzzle();
});
