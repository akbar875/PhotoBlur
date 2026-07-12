const API_BASE_URL = "http://127.0.0.1:5000";

export async function detectGesture(image) {
  const response = await fetch(`${API_BASE_URL}/api/detect-gesture`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  });

  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || "Gesture API gagal merespons");
  }

  return response.json();
}

export async function getGestureHealth() {
  const response = await fetch(`${API_BASE_URL}/api/health`);
  if (!response.ok) {
    throw new Error("Backend gesture belum siap");
  }
  return response.json();
}
