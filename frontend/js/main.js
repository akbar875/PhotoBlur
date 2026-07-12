const startButton = document.querySelector("#startButton");
const modal = document.querySelector("#photoModal");
const closeModal = document.querySelector("#closeModal");

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
    window.location.href = "camera.html";
  });
});
