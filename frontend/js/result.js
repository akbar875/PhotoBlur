import { downloadDataUrl } from "./download.js";

const result = sessionStorage.getItem("photoblur:result");
const image = document.querySelector("#resultImage");

if (!result) {
  document.querySelector(".result-panel").innerHTML = `
    <p class="eyebrow">Belum Ada Hasil</p>
    <h1>Belum ada foto final.</h1>
    <p class="lead">Mulai dari kamera dulu supaya hasil Photoblur bisa dibuat.</p>
    <button class="primary-btn" type="button" id="startAgain">Mulai Foto Sekarang</button>
  `;
  document.querySelector("#startAgain").addEventListener("click", () => {
    window.location.href = "index.html";
  });
} else {
  image.src = result;
  document.querySelector("#downloadButton").addEventListener("click", () => {
    downloadDataUrl(result, `photoblur-${Date.now()}.png`);
  });
  document.querySelector("#editButton").addEventListener("click", () => {
    window.location.href = "editor.html";
  });
  document.querySelector("#retakeButton").addEventListener("click", () => {
    window.location.href = "camera.html";
  });
  document.querySelector("#homeButton").addEventListener("click", () => {
    window.location.href = "index.html";
  });
}
