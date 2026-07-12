from flask import Flask, jsonify, request
from flask_cors import CORS

from services.gesture_detector import PeaceGestureDetector
from services.image_processor import normalize_frame
from utils.image_decoder import decode_base64_image


app = Flask(__name__)
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


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
