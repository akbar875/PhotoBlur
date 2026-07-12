import math
import os
from dataclasses import dataclass

import cv2


os.environ.setdefault(
    "MPLCONFIGDIR",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".matplotlib")),
)

try:
    import mediapipe as mp
    try:
        mp_hands = mp.solutions.hands
    except AttributeError:
        try:
            from mediapipe.python.solutions import hands as mp_hands
        except ImportError:
            mp_hands = None
except ImportError:  # Allows the API to start before dependencies are installed.
    mp = None
    mp_hands = None


@dataclass
class GestureResult:
    hand_detected: bool
    peace_detected: bool
    confidence: float
    message: str = ""

    def to_dict(self):
        return {
            "hand_detected": self.hand_detected,
            "peace_detected": self.peace_detected,
            "confidence": round(float(self.confidence), 2),
            "message": self.message,
        }


class PeaceGestureDetector:
    def __init__(self):
        self.available = mp_hands is not None
        self.hands = None

        if self.available:
            self.hands = mp_hands.Hands(
                static_image_mode=False,
                max_num_hands=2,
                min_detection_confidence=0.65,
                min_tracking_confidence=0.65,
            )

    def detect(self, frame):
        if not self.available:
            return GestureResult(
                hand_detected=False,
                peace_detected=False,
                confidence=0,
                message="MediaPipe hand solution belum tersedia. Gunakan Python/MediaPipe yang menyediakan mediapipe.solutions.hands.",
            ).to_dict()

        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb_frame.flags.writeable = False
        results = self.hands.process(rgb_frame)

        if not results.multi_hand_landmarks:
            return GestureResult(False, False, 0, "Tidak ada tangan terdeteksi.").to_dict()

        best_confidence = 0.0
        for hand_landmarks in results.multi_hand_landmarks:
            landmarks = hand_landmarks.landmark
            peace, confidence = self._is_peace(landmarks)
            best_confidence = max(best_confidence, confidence)
            if peace:
                return GestureResult(True, True, confidence, "Pose peace terdeteksi.").to_dict()

        return GestureResult(True, False, best_confidence, "Tangan terdeteksi, pose belum peace.").to_dict()

    def _is_peace(self, lm):
        index_up = self._finger_extended(lm, 8, 6, 5)
        middle_up = self._finger_extended(lm, 12, 10, 9)
        ring_down = not self._finger_extended(lm, 16, 14, 13)
        pinky_down = not self._finger_extended(lm, 20, 18, 17)

        index_middle_gap = self._distance(lm[8], lm[12])
        index_ring_gap = self._distance(lm[8], lm[16])
        fingers_separated = index_middle_gap > 0.055 and index_ring_gap > 0.075

        checks = [index_up, middle_up, ring_down, pinky_down, fingers_separated]
        confidence = sum(1 for value in checks if value) / len(checks)
        return all(checks), confidence

    def _finger_extended(self, lm, tip, pip, mcp):
        vertical_open = lm[tip].y < lm[pip].y < lm[mcp].y
        tip_to_mcp = self._distance(lm[tip], lm[mcp])
        pip_to_mcp = self._distance(lm[pip], lm[mcp])
        return vertical_open and tip_to_mcp > pip_to_mcp * 1.12

    def _distance(self, a, b):
        return math.hypot(a.x - b.x, a.y - b.y)
