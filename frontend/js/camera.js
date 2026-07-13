import { detectGesture, getGestureHealth } from "./api.js";

const modeLabel = document.querySelector("#modeLabel");
const apiStatus = document.querySelector("#apiStatus");
const video = document.querySelector("#cameraVideo");
const cameraWrapper = document.querySelector(".camera-wrapper");
const canvas = document.querySelector("#captureCanvas");
const gestureStatus = document.querySelector("#gestureStatus");
const photoCounter = document.querySelector("#photoCounter");
const countdownDisplay = document.querySelector("#countdownDisplay");
const loveBurst = document.querySelector("#loveBurst");
const thumbnailGrid = document.querySelector("#thumbnailGrid");
const cameraMusic = document.querySelector("#cameraMusic");
const completionPanel = document.querySelector("#completionPanel");
const retakeButton = document.querySelector("#retakeButton");
const resetButton = document.querySelector("#resetButton");
const continueButton = document.querySelector("#continueButton");

const selectedCount = Number(sessionStorage.getItem("photoblur:photoCount") || 0);
const embeddedSession = window.parent !== window;
const requiredStableFrames = 4;

if (embeddedSession && cameraMusic) {
  cameraMusic.removeAttribute("autoplay");
  cameraMusic.pause();
}
let photos = JSON.parse(sessionStorage.getItem("photoblur:photos") || "[]");
let requestInProgress = false;
let stableFrames = 0;
let detectionTimer = null;
let cooldownUntil = 0;
let gestureBackendReady = false;
let captureInProgress = false;
let musicStarted = false;
let musicRetryTimer = null;
const musicSegments = {
  2: { start: 140, end: 155 },
  4: { start: 128, end: 155 },
};
const loveSymbols = ["\u{1f497}", "\u{1f496}", "\u{1f495}", "\u{1f498}", "\u{1f49e}"];
const lovePattern = [
  { x: 18, y: 62, size: 28, delay: 0, drift: -18 },
  { x: 28, y: 34, size: 18, delay: 90, drift: 14 },
  { x: 43, y: 22, size: 14, delay: 30, drift: -10 },
  { x: 56, y: 42, size: 22, delay: 130, drift: 20 },
  { x: 68, y: 25, size: 16, delay: 70, drift: -14 },
  { x: 76, y: 56, size: 30, delay: 20, drift: 16 },
  { x: 87, y: 38, size: 20, delay: 120, drift: -16 },
  { x: 14, y: 28, size: 14, delay: 170, drift: 10 },
  { x: 48, y: 66, size: 16, delay: 180, drift: -8 },
];

if (![2, 4].includes(selectedCount)) {
  window.location.href = "index.html";
} else {
  modeLabel.textContent = `${selectedCount} Foto`;
  thumbnailGrid.style.setProperty("--slot-count", selectedCount);
  if (!embeddedSession) prepareCameraMusic();
  renderState();
  startCamera();
}

async function startCamera() {
  try {
    const health = await getGestureHealth();
    gestureBackendReady = Boolean(health.mediapipe_available);
    apiStatus.textContent = gestureBackendReady ? "Gesture backend aktif" : "Backend aktif, detektor belum siap";
    if (!gestureBackendReady) {
      gestureStatus.textContent = health.mediapipe_error || "MediaPipe hand detector belum aktif di backend.";
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: "user",
        width: { ideal: 1280 },
        height: { ideal: 960 },
      },
      audio: false,
    });
    video.srcObject = stream;
    detectionTimer = window.setInterval(sendFrameForDetection, 200);
  } catch (error) {
    apiStatus.textContent = "Backend atau kamera belum aktif";
    gestureStatus.textContent = error.message || "Izin kamera ditolak atau perangkat tidak tersedia.";
    console.error(error);
  }
}

async function sendFrameForDetection() {
  if (!gestureBackendReady || requestInProgress || captureInProgress || Date.now() < cooldownUntil || photos.length >= selectedCount) {
    return;
  }

  if (!video.videoWidth) return;

  requestInProgress = true;
  try {
    const image = snapshotFromVideo(640, 480, 0.68);
    const result = await detectGesture(image);
    updateDetection(result);
  } catch (error) {
    apiStatus.textContent = "Backend gesture belum siap";
    gestureStatus.textContent = error.message;
    stableFrames = 0;
    updateStability();
  } finally {
    requestInProgress = false;
  }
}

function updateDetection(result) {
  if (result.message && !result.hand_detected && result.confidence === 0) {
    gestureStatus.textContent = result.message;
    stableFrames = 0;
    updateStability();
    return;
  }

  if (result.peace_detected) {
    stableFrames = Math.min(requiredStableFrames, stableFrames + 1);
    gestureStatus.textContent = stableFrames >= requiredStableFrames ? "Pose stabil, foto diambil" : "Pose peace terdeteksi";
  } else {
    stableFrames = Math.max(0, stableFrames - 1);
    gestureStatus.textContent = result.hand_detected ? "Tahan pose peace lebih jelas" : "Pose peace belum terdeteksi";
  }

  updateStability();

  if (stableFrames >= requiredStableFrames) {
    capturePhoto();
  }
}

function updateStability() {
  cameraWrapper.dataset.stability = String(Math.round((stableFrames / requiredStableFrames) * 100));
}

function snapshotFromVideo(width = video.videoWidth, height = video.videoHeight, quality = 0.92) {
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  context.save();
  context.translate(width, 0);
  context.scale(-1, 1);
  context.drawImage(video, 0, 0, width, height);
  context.restore();
  return canvas.toDataURL("image/jpeg", quality);
}

function capturePhoto() {
  if (photos.length >= selectedCount || captureInProgress) return;
  captureInProgress = true;
  renderLoveBurst();
  cameraWrapper.classList.add("is-capturing");
  countdownDisplay.textContent = "";

  photos.push(snapshotFromVideo(video.videoWidth || 1280, video.videoHeight || 960, 0.92));
  persistPhotos();
  stableFrames = 0;
  cooldownUntil = Date.now() + 1400;
  gestureStatus.textContent = photos.length >= selectedCount ? "Foto lengkap, lanjut hias foto" : "Foto tersimpan. Siap untuk foto berikutnya.";
  updateStability();
  renderState();
  window.setTimeout(() => {
    cameraWrapper.classList.remove("is-capturing");
    captureInProgress = false;
    countdownDisplay.textContent = "";
    loveBurst.innerHTML = "";
  }, 1050);
}

function renderLoveBurst() {
  loveBurst.innerHTML = "";
  lovePattern.forEach((item, index) => {
    const heart = document.createElement("span");
    heart.textContent = loveSymbols[index % loveSymbols.length];
    heart.style.setProperty("--x", `${item.x}%`);
    heart.style.setProperty("--y", `${item.y}%`);
    heart.style.setProperty("--size", `${item.size}px`);
    heart.style.setProperty("--delay", `${item.delay}ms`);
    heart.style.setProperty("--drift", `${item.drift}px`);
    loveBurst.append(heart);
  });
}

function currentMusicSegment() {
  return musicSegments[selectedCount] || musicSegments[2];
}

function notifyParentMusic(action) {
  if (!embeddedSession) return;
  window.parent.postMessage({
    type: `photoblur:music-${action}`,
    photoCount: selectedCount,
  }, "*");
}

function prepareCameraMusic() {
  if (!cameraMusic || embeddedSession) return;
  cameraMusic.volume = 0.7;
  cameraMusic.muted = false;
  cameraMusic.autoplay = true;
  cameraMusic.load();
  syncMusicSegment();
  cameraMusic.addEventListener("canplay", playCameraMusic, { once: true });
  window.setTimeout(playCameraMusic, 250);
  musicRetryTimer = window.setInterval(() => {
    if (musicStarted || photos.length >= selectedCount) {
      window.clearInterval(musicRetryTimer);
      musicRetryTimer = null;
      return;
    }
    playCameraMusic();
  }, 1800);
}

function syncMusicSegment() {
  if (!cameraMusic) return;
  const segment = currentMusicSegment();
  if (cameraMusic.readyState >= 1 && (!Number.isFinite(cameraMusic.duration) || cameraMusic.duration > segment.start)) {
    cameraMusic.currentTime = segment.start;
  }
}

async function playCameraMusic() {
  if (!cameraMusic || embeddedSession || photos.length >= selectedCount) return;
  cameraMusic.volume = 0.7;
  cameraMusic.muted = false;
  if (cameraMusic.readyState >= 1) syncMusicSegment();

  try {
    await cameraMusic.play();
    musicStarted = true;
    window.setTimeout(syncMusicSegment, 40);
  } catch {
    musicStarted = false;
  }
}

function stopCameraMusic() {
  if (!cameraMusic) return;
  cameraMusic.pause();
  musicStarted = false;
  if (musicRetryTimer) {
    window.clearInterval(musicRetryTimer);
    musicRetryTimer = null;
  }
  syncMusicSegment();
}

function renderState() {
  const complete = photos.length === selectedCount;
  photoCounter.textContent = `${photos.length}/${selectedCount}`;
  completionPanel.hidden = !complete;
  continueButton.disabled = !complete;
  retakeButton.disabled = photos.length === 0;
  resetButton.disabled = photos.length === 0;
  thumbnailGrid.innerHTML = "";

  for (let index = 0; index < selectedCount; index += 1) {
    const slot = document.createElement("div");
    slot.className = "photo-slot";
    if (photos[index]) {
      const image = document.createElement("img");
      image.src = photos[index];
      image.alt = `Foto ${index + 1}`;
      slot.append(image);
    } else {
      const label = document.createElement("span");
      label.textContent = index + 1;
      slot.append(label);
    }
    thumbnailGrid.append(slot);
  }
}

function persistPhotos() {
  sessionStorage.setItem("photoblur:photos", JSON.stringify(photos));
}

retakeButton.addEventListener("click", () => {
  photos.pop();
  persistPhotos();
  stableFrames = 0;
  countdownDisplay.textContent = "";
  cameraWrapper.classList.remove("is-capturing");
  captureInProgress = false;
  cooldownUntil = Date.now() + 700;
  gestureStatus.textContent = "Foto terakhir dihapus. Ambil ulang dengan pose peace.";
  notifyParentMusic("start");
  playCameraMusic();
  updateStability();
  renderState();
});

resetButton.addEventListener("click", () => {
  photos = [];
  persistPhotos();
  stableFrames = 0;
  countdownDisplay.textContent = "";
  cameraWrapper.classList.remove("is-capturing");
  captureInProgress = false;
  cooldownUntil = Date.now() + 700;
  gestureStatus.textContent = "Semua foto dihapus. Mulai lagi dari slot pertama.";
  notifyParentMusic("start");
  syncMusicSegment();
  playCameraMusic();
  updateStability();
  renderState();
});

continueButton.addEventListener("click", () => {
  if (photos.length === selectedCount) {
    window.clearInterval(detectionTimer);
    stopCameraMusic();
    notifyParentMusic("stop");
    window.location.href = "editor.html";
  }
});

cameraMusic?.addEventListener("loadedmetadata", () => {
  if (embeddedSession) return;
  syncMusicSegment();
  playCameraMusic();
});

cameraMusic?.addEventListener("timeupdate", () => {
  if (embeddedSession) return;
  const segment = currentMusicSegment();
  if (cameraMusic.currentTime < segment.start - 0.25 && !cameraMusic.seeking) {
    cameraMusic.currentTime = segment.start;
    return;
  }

  if (cameraMusic.currentTime >= segment.end) {
    cameraMusic.currentTime = segment.start;
    if (!cameraMusic.paused) cameraMusic.play().catch(() => {});
  }
});

["pointerdown", "click", "keydown", "touchstart"].forEach((eventName) => {
  window.addEventListener(eventName, () => {
    if (embeddedSession) return;
    if (!musicStarted) playCameraMusic();
  }, { passive: true });
});
