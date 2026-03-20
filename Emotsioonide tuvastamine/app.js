const video = document.getElementById("video");
const emotionLabel = document.getElementById("emotionLabel");
const confidenceLabel = document.getElementById("confidenceLabel");
const infoText = document.getElementById("infoText");
const emotionEffect = document.getElementById("emotionEffect");
const retryButton = document.getElementById("retryButton");

const MODEL_URL = "https://justadudewhohacks.github.io/face-api.js/models";

const emotionMap = {
  happy: { className: "emotion-happy", label: "Happy" },
  sad: { className: "emotion-sad", label: "Sad" },
  neutral: { className: "emotion-neutral", label: "Neutral" },
  angry: { className: "emotion-angry", label: "Angry" },
  humility: { className: "emotion-humility", label: "Смирение" }
};

const effectImageMap = {
  happy: "happy.png",
  sad: "sad.png",
  neutral: "calm.png",
  angry: "angry.png",
  humility: "dog.jpg"
};

const EYE_CLOSED_EAR_THRESHOLD = 0.28;
const EYE_CLOSED_BASELINE_RATIO = 0.72;

let detectIntervalId = null;
let isInitializing = false;
let effectAnimationFrameId = null;
let openEyesEarBaseline = null;
const effectPositionState = {
  currentLeft: 0,
  currentTop: 0,
  targetLeft: 0,
  targetTop: 0,
  hasPosition: false
};

function animateEmotionEffect() {
  if (emotionEffect.hidden) {
    effectAnimationFrameId = null;
    return;
  }

  const lerpFactor = 0.12;
  effectPositionState.currentLeft += (effectPositionState.targetLeft - effectPositionState.currentLeft) * lerpFactor;
  effectPositionState.currentTop += (effectPositionState.targetTop - effectPositionState.currentTop) * lerpFactor;

  emotionEffect.style.left = `${effectPositionState.currentLeft}px`;
  emotionEffect.style.top = `${effectPositionState.currentTop}px`;

  effectAnimationFrameId = requestAnimationFrame(animateEmotionEffect);
}

function updateEmotionEffectTarget(left, top) {
  effectPositionState.targetLeft = left;
  effectPositionState.targetTop = top;

  if (!effectPositionState.hasPosition) {
    effectPositionState.currentLeft = left;
    effectPositionState.currentTop = top;
    emotionEffect.style.left = `${left}px`;
    emotionEffect.style.top = `${top}px`;
    effectPositionState.hasPosition = true;
  }

  if (!effectAnimationFrameId) {
    effectAnimationFrameId = requestAnimationFrame(animateEmotionEffect);
  }
}

async function loadModels() {
  infoText.textContent = "Loading AI models...";
  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
    faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
    faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL)
  ]);
}

function pointDistance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function calculateEyeAspectRatio(eyePoints) {
  if (!eyePoints || eyePoints.length < 6) {
    return 1;
  }

  const verticalA = pointDistance(eyePoints[1], eyePoints[5]);
  const verticalB = pointDistance(eyePoints[2], eyePoints[4]);
  const horizontal = pointDistance(eyePoints[0], eyePoints[3]);

  if (horizontal === 0) {
    return 1;
  }

  return (verticalA + verticalB) / (2 * horizontal);
}

function getAverageEyeAspectRatio(landmarks) {
  if (!landmarks) {
    return null;
  }

  const leftEye = landmarks.getLeftEye();
  const rightEye = landmarks.getRightEye();
  const leftEAR = calculateEyeAspectRatio(leftEye);
  const rightEAR = calculateEyeAspectRatio(rightEye);
  return (leftEAR + rightEAR) / 2;
}

function areEyesClosed(averageEAR) {
  if (averageEAR === null || Number.isNaN(averageEAR)) {
    return false;
  }

  const absoluteClosed = averageEAR < EYE_CLOSED_EAR_THRESHOLD;
  const relativeClosed =
    openEyesEarBaseline !== null && averageEAR < openEyesEarBaseline * EYE_CLOSED_BASELINE_RATIO;

  return absoluteClosed || relativeClosed;
}

function updateOpenEyesBaseline(averageEAR, eyesClosed) {
  if (averageEAR === null || Number.isNaN(averageEAR) || eyesClosed) {
    return;
  }

  if (openEyesEarBaseline === null) {
    openEyesEarBaseline = averageEAR;
    return;
  }

  const baselineSmoothing = 0.08;
  openEyesEarBaseline += (averageEAR - openEyesEarBaseline) * baselineSmoothing;
}

function getCameraErrorMessage(error) {
  const name = error?.name;

  if (name === "NotAllowedError") {
    return "Camera access was denied. Allow camera permission and reload the page.";
  }

  if (name === "NotReadableError") {
    return "Camera could not start (it may still be locked by another app or the camera driver). Close camera apps, wait 3 seconds, and press Retry camera.";
  }

  if (name === "NotFoundError") {
    return "No camera device was found on this computer.";
  }

  if (name === "OverconstrainedError") {
    return "The requested camera settings are not supported by your device.";
  }

  if (name === "SecurityError") {
    return "Camera is blocked by browser or OS privacy settings.";
  }

  return "Startup failed. Check camera permissions, internet connection, and open the app using localhost or https.";
}

function stopCurrentStream() {
  const currentStream = video.srcObject;
  if (currentStream && typeof currentStream.getTracks === "function") {
    for (const track of currentStream.getTracks()) {
      track.stop();
    }
  }
  video.srcObject = null;
}

async function getVideoDeviceConstraints() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const firstVideo = devices.find((device) => device.kind === "videoinput");
    if (firstVideo?.deviceId) {
      return { video: { deviceId: { exact: firstVideo.deviceId } }, audio: false };
    }
  } catch (error) {
    console.warn("Device enumeration failed:", error);
  }

  return null;
}

async function startCamera() {
  stopCurrentStream();

  const constraintsList = [
    { video: { facingMode: "user" }, audio: false },
    { video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
    { video: true, audio: false }
  ];

  const explicitDeviceConstraints = await getVideoDeviceConstraints();
  if (explicitDeviceConstraints) {
    constraintsList.unshift(explicitDeviceConstraints);
  }

  let stream;
  let lastError;

  for (const constraints of constraintsList) {
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
      break;
    } catch (error) {
      lastError = error;
    }
  }

  if (!stream) {
    throw lastError || new Error("Unable to start camera stream.");
  }

  video.srcObject = stream;

  await new Promise((resolve) => {
    video.onloadedmetadata = () => resolve();
  });

  await video.play();
}

function pickSupportedEmotion(expressions) {
  const candidates = ["happy", "sad", "neutral", "angry"];
  let winner = "neutral";
  let maxScore = -1;

  for (const key of candidates) {
    const score = expressions[key] ?? 0;
    if (score > maxScore) {
      maxScore = score;
      winner = key;
    }
  }

  return { emotion: winner, confidence: maxScore };
}

function applyEmotion({ emotion, confidence }) {
  const details = emotionMap[emotion] ?? emotionMap.neutral;
  document.body.classList.remove(
    "emotion-happy",
    "emotion-sad",
    "emotion-neutral",
    "emotion-angry",
    "emotion-humility"
  );
  document.body.classList.add(details.className);

  emotionLabel.textContent = details.label;
  confidenceLabel.textContent = `${Math.round(confidence * 100)}%`;
}

function mapDetectionBoxToDisplay(box) {
  const frameWidth = video.clientWidth;
  const frameHeight = video.clientHeight;
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;

  if (!frameWidth || !frameHeight || !sourceWidth || !sourceHeight) {
    return box;
  }

  const scale = Math.max(frameWidth / sourceWidth, frameHeight / sourceHeight);
  const drawnWidth = sourceWidth * scale;
  const drawnHeight = sourceHeight * scale;
  const offsetX = (frameWidth - drawnWidth) / 2;
  const offsetY = (frameHeight - drawnHeight) / 2;

  return {
    x: box.x * scale + offsetX,
    y: box.y * scale + offsetY,
    width: box.width * scale,
    height: box.height * scale
  };
}

function hideEmotionEffect() {
  emotionEffect.hidden = true;
  effectPositionState.hasPosition = false;

  if (effectAnimationFrameId) {
    cancelAnimationFrame(effectAnimationFrameId);
    effectAnimationFrameId = null;
  }
}

function showEmotionEffect(emotion, box) {
  const imageSrc = effectImageMap[emotion];
  if (!imageSrc || !box) {
    hideEmotionEffect();
    return;
  }

  const mapped = mapDetectionBoxToDisplay(box);
  const frameWidth = video.clientWidth;
  const frameHeight = video.clientHeight;
  const effectWidth = emotionEffect.offsetWidth || 96;
  const effectHeight = emotionEffect.offsetHeight || 96;
  const gap = 12;
  const crownOffset = 8;
  const leftShift = 24;

  emotionEffect.src = imageSrc;
  emotionEffect.hidden = false;

  let left = mapped.x + mapped.width + gap - leftShift;
  let top = mapped.y - crownOffset;

  left = Math.min(Math.max(left, 6), Math.max(6, frameWidth - effectWidth - 6));
  top = Math.min(Math.max(top, effectHeight / 2 + 6), Math.max(effectHeight / 2 + 6, frameHeight - effectHeight / 2 - 6));
  updateEmotionEffectTarget(left, top);
}

async function detectLoop() {
  const options = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.45
  });

  if (detectIntervalId) {
    clearInterval(detectIntervalId);
  }

  detectIntervalId = setInterval(async () => {
    if (video.readyState < 2) {
      return;
    }

    const result = await faceapi
      .detectSingleFace(video, options)
      .withFaceLandmarks(true)
      .withFaceExpressions();

    if (!result) {
      openEyesEarBaseline = null;
      infoText.textContent = "No face detected. Please look at the camera.";
      applyEmotion({ emotion: "neutral", confidence: 0 });
      hideEmotionEffect();
      return;
    }

    const averageEAR = getAverageEyeAspectRatio(result.landmarks);
    const eyesClosed = areEyesClosed(averageEAR);
    updateOpenEyesBaseline(averageEAR, eyesClosed);

    let picked = pickSupportedEmotion(result.expressions);

    const calmFace = picked.emotion === "neutral";

    if (eyesClosed && calmFace) {
      picked = { emotion: "humility", confidence: 1 };
      infoText.textContent = "Emotion: Смирение (eyes closed + calm face).";
    } else if (eyesClosed && !calmFace) {
      infoText.textContent = "Eyes are closed, but face is not calm. Смирение is not counted.";
    } else {
      infoText.textContent = "Detection is active. Change your expression to see the background update.";
    }

    applyEmotion(picked);
    showEmotionEffect(picked.emotion, result.detection.box);
  }, 700);
}

async function initializeApp() {
  if (isInitializing) {
    return;
  }

  isInitializing = true;
  retryButton.disabled = true;

  if (!navigator.mediaDevices?.getUserMedia) {
    infoText.textContent = "Your browser does not support camera access, or access is blocked.";
    retryButton.disabled = false;
    isInitializing = false;
    return;
  }

  if (!window.isSecureContext) {
    infoText.textContent = "Camera requires a secure context. Open this app with https or localhost.";
    retryButton.disabled = false;
    isInitializing = false;
    return;
  }

  try {
    await loadModels();
    await startCamera();
    infoText.textContent = "Camera is ready. Starting emotion detection...";
    await detectLoop();
  } catch (error) {
    console.error(error);
    infoText.textContent = getCameraErrorMessage(error);
  } finally {
    retryButton.disabled = false;
    isInitializing = false;
  }
}

retryButton.addEventListener("click", async () => {
  infoText.textContent = "Retrying camera startup...";
  await initializeApp();
});

initializeApp();
