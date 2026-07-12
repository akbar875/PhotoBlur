import cv2


def normalize_frame(frame, width: int = 640):
    if frame is None:
        return None

    height, current_width = frame.shape[:2]
    if current_width <= width:
        return frame

    ratio = width / current_width
    target_size = (width, int(height * ratio))
    return cv2.resize(frame, target_size, interpolation=cv2.INTER_AREA)
