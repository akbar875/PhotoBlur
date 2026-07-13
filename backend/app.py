import os
import sys
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

if __package__:
    from .services.gesture_detector import PeaceGestureDetector
    from .services.image_processor import normalize_frame
    from .utils.image_decoder import decode_base64_image
else:
    sys.path.append(str(Path(__file__).resolve().parent))
    from services.gesture_detector import PeaceGestureDetector
    from services.image_processor import normalize_frame
    from utils.image_decoder import decode_base64_image


BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")
CORS(app)

detector = PeaceGestureDetector()


@app.get("/api/health")
def health():
    return jsonify({
        "status": "ok",
        "mediapipe_available": detector.available,
    })


@app.post("/api/detect-gesture")
def detect_gesture():
    payload = request.get_json(silent=True) or {}
    image_data = payload.get("image")

    if not image_data:
        return jsonify({"error": "image is required"}), 400

    frame = decode_base64_image(image_data)
    if frame is None:
        return jsonify({"error": "invalid image"}), 400

    frame = normalize_frame(frame)
    return jsonify(detector.detect(frame))


@app.get("/")
def serve_index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.get("/<path:filename>")
def serve_frontend(filename):
    requested_file = FRONTEND_DIR / filename
    if requested_file.is_file():
        return send_from_directory(FRONTEND_DIR, filename)
    return send_from_directory(FRONTEND_DIR, "index.html")


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=True)
