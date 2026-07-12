import { detectGesture, getGestureHealth } from "./api.js";

const modeLabel = document.querySelector("#modeLabel");
const apiStatus = document.querySelector("#apiStatus");
const video = document.querySelector("#cameraVideo");
const cameraWrapper = document.querySelector(".camera-wrapper");
const canvas = document.querySelector("#captureCanvas");
const gestureStatus = document.querySelector("#gestureStatus");
const photoCounter = document.querySelector("#photoCounter");
const countdownDisplay = document.querySelector("#countdownDisplay");
const thumbnailGrid = document.querySelector("#thumbnailGrid");
const completionPanel = document.querySelector("#completionPanel");
const retakeButton = document.querySelector("#retakeButton");
const resetButton = document.querySelector("#resetButton");
const continueButton = document.querySelector("#continueButton");

const selectedCount = Number(sessionStorage.getItem("photoblur:photoCount") || 0);
const requiredStableFrames = 4;
let photos = JSON.parse(sessionStorage.getItem("photoblur:photos") || "[]");
let requestInProgress = false;
let stableFrames = 0;
let detectionTimer = null;
let cooldownUntil = 0;
let gestureBackendReady = false;
let captureInProgress = false;

if (![2, 4].includes(selectedCount)) {
  window.location.href = "index.html";
} else {
  modeLabel.textContent = `${selectedCount} Foto`;
  thumbnailGrid.style.setProperty("--slot-count", selectedCount);
  renderState();
  startCamera();
}

async function startCamera() {
  try {
    const health = await getGestureHealth();
    gestureBackendReady = Boolean(health.mediapipe_available);
    apiStatus.textContent = gestureBackendReady ? "Gesture backend aktif" : "Backend aktif, detektor belum siap";
    if (!gestureBackendReady) {
      gestureStatus.textContent = "MediaPipe hand detector belum aktif. Jalankan backend dengan Python 3.9.";
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
  }, 1050);
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
  updateStability();
  renderState();
});

continueButton.addEventListener("click", () => {
  if (photos.length === selectedCount) {
    window.clearInterval(detectionTimer);
    window.location.href = "editor.html";
  }
});
