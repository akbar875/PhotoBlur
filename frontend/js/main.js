const startButton = document.querySelector("#startButton");
const modal = document.querySelector("#photoModal");
const closeModal = document.querySelector("#closeModal");
const sessionShell = document.querySelector("#sessionShell");
const sessionFrame = document.querySelector("#sessionFrame");
const sessionMusic = document.querySelector("#sessionMusic");

const musicSegments = {
  2: { start: 140, end: 155 },
  4: { start: 128, end: 155 },
};

let activeMusicSegment = null;
let audioContext = null;
let audioBufferPromise = null;
let activeAudioSource = null;
let audioLoopTimer = null;
let musicRunId = 0;

sessionMusic?.load();

function openModal() {
  modal.classList.add("is-open");
}

function closeModalDialog() {
  modal.classList.remove("is-open");
}

startButton.addEventListener("click", openModal);
closeModal.addEventListener("click", closeModalDialog);
modal.addEventListener("click", (event) => {
  if (event.target === modal) closeModalDialog();
});

document.querySelectorAll("[data-count]").forEach((button) => {
  button.addEventListener("click", () => {
    const count = Number(button.dataset.count);
    sessionStorage.setItem("photoblur:photoCount", String(count));
    sessionStorage.removeItem("photoblur:photos");
    sessionStorage.removeItem("photoblur:result");
    startSessionMusic(count);
    openCameraSession();
  });
});

function startSessionMusic(count) {
  activeMusicSegment = musicSegments[count] || musicSegments[2];
  const runId = ++musicRunId;
  stopWebAudioSource();
  startWebAudioMusic(runId).catch(() => {
    if (runId === musicRunId) startHtmlAudioFallback();
  });
}

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext ||= new AudioContextClass();
  return audioContext;
}

function loadMusicBuffer() {
  const context = getAudioContext();
  if (!context) return Promise.reject(new Error("Web Audio tidak didukung browser ini."));

  audioBufferPromise ||= fetch("assets/audio/camera-music.mp3")
    .then((response) => {
      if (!response.ok) throw new Error("File musik tidak bisa dimuat.");
      return response.arrayBuffer();
    })
    .then((arrayBuffer) => context.decodeAudioData(arrayBuffer));

  return audioBufferPromise;
}

async function startWebAudioMusic(runId) {
  const context = getAudioContext();
  if (!context || !activeMusicSegment) throw new Error("Audio belum siap.");

  await context.resume();
  const buffer = await loadMusicBuffer();
  if (runId === musicRunId) playWebAudioSegment(buffer);
}

function playWebAudioSegment(buffer) {
  const context = getAudioContext();
  if (!context || !activeMusicSegment) return;

  stopWebAudioSource();

  const source = context.createBufferSource();
  const gain = context.createGain();
  const duration = activeMusicSegment.end - activeMusicSegment.start;

  gain.gain.value = 0.74;
  source.buffer = buffer;
  source.connect(gain);
  gain.connect(context.destination);
  source.start(0, activeMusicSegment.start, duration);

  activeAudioSource = source;
  audioLoopTimer = window.setTimeout(() => {
    playWebAudioSegment(buffer);
  }, duration * 1000);
}

function stopWebAudioSource() {
  if (audioLoopTimer) {
    window.clearTimeout(audioLoopTimer);
    audioLoopTimer = null;
  }

  if (activeAudioSource) {
    try {
      activeAudioSource.stop();
    } catch {
      // Source may already be stopped by the browser.
    }
    activeAudioSource.disconnect();
    activeAudioSource = null;
  }
}

function startHtmlAudioFallback() {
  if (!sessionMusic || !activeMusicSegment) return;

  sessionMusic.pause();
  sessionMusic.volume = 0.74;
  sessionMusic.muted = false;

  seekSessionMusic();

  sessionMusic.play().catch(() => {
    sessionMusic.muted = false;
  });

  window.setTimeout(seekSessionMusic, 40);
}

function seekSessionMusic() {
  if (!sessionMusic || !activeMusicSegment || sessionMusic.readyState < 1) return;
  if (Math.abs(sessionMusic.currentTime - activeMusicSegment.start) > 0.35) {
    sessionMusic.currentTime = activeMusicSegment.start;
  }
}

function stopSessionMusic() {
  musicRunId += 1;
  stopWebAudioSource();
  if (sessionMusic) {
    sessionMusic.pause();
    if (activeMusicSegment && sessionMusic.readyState >= 1) sessionMusic.currentTime = activeMusicSegment.start;
  }
}

function openCameraSession() {
  closeModalDialog();
  sessionShell.hidden = false;
  sessionFrame.src = "camera.html";
}

sessionMusic?.addEventListener("timeupdate", () => {
  if (!activeMusicSegment) return;
  if (sessionMusic.currentTime < activeMusicSegment.start - 0.35 && !sessionMusic.seeking) {
    sessionMusic.currentTime = activeMusicSegment.start;
    return;
  }

  if (sessionMusic.currentTime >= activeMusicSegment.end) {
    sessionMusic.currentTime = activeMusicSegment.start;
    if (!sessionMusic.paused) sessionMusic.play().catch(() => {});
  }
});

sessionMusic?.addEventListener("loadedmetadata", seekSessionMusic);

window.addEventListener("message", (event) => {
  if (event.data?.type === "photoblur:music-stop") {
    stopSessionMusic();
    return;
  }

  if (event.data?.type === "photoblur:music-start") {
    startSessionMusic(Number(event.data.photoCount || sessionStorage.getItem("photoblur:photoCount") || 2));
  }
});
