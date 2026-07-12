import base64
from typing import Optional

import cv2
import numpy as np


def decode_base64_image(image_data: str) -> Optional[np.ndarray]:
    """Decode a data URL or raw base64 image into an OpenCV BGR frame."""
    if not image_data:
        return None

    if "," in image_data:
        image_data = image_data.split(",", 1)[1]

    try:
        binary = base64.b64decode(image_data, validate=True)
        buffer = np.frombuffer(binary, dtype=np.uint8)
        frame = cv2.imdecode(buffer, cv2.IMREAD_COLOR)
        return frame
    except Exception:
        return None
