"""
Face detection and crop preprocessing -- the single definition of how any image
becomes model input.

Both sides of the system import from here: `inference.py` when a webcam frame
arrives, and `ml_scripts/focus/dataset_builder.py` when the training set is
built. One implementation is the whole point: the model only ever sees images
produced by this file, so training images and webcam frames stay in the same
domain. If the crop rule changes it changes for both at once -- otherwise the
model is being asked at inference time to read a kind of image it never saw.

Nothing here imports TensorFlow at module level; `preprocess()` pulls in Keras
lazily so the dataset builder can crop tens of thousands of frames without
paying for a TF import it does not need.
"""
import cv2
import numpy as np

IMG_SIZE      = 224      # model input side, training and inference alike
FACE_PAD      = 0.15     # margin added on each side, as a fraction of min(w, h)
SCALE_FACTOR  = 1.1      # Haar pyramid step
MIN_NEIGHBORS = 5
MIN_FACE      = (80, 80)

_cascade = None


def get_cascade():
    """Frontal-face Haar cascade, loaded once."""
    global _cascade
    if _cascade is None:
        _cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        )
    return _cascade


def detect_face(frame_bgr, min_face=MIN_FACE):
    """Largest face in the frame, padded by FACE_PAD.

    Returns (crop_bgr, (x1, y1, x2, y2)), or (None, None) when no face is
    found. The crop is deliberately *not* resized -- callers that want model
    input call resize_input() or preprocess() on it, and callers that want to
    write a training image keep the crop at its native resolution until the
    single resize at the end.
    """
    gray  = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    faces = get_cascade().detectMultiScale(
        gray, scaleFactor=SCALE_FACTOR, minNeighbors=MIN_NEIGHBORS, minSize=min_face
    )
    if len(faces) == 0:
        return None, None

    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
    pad    = int(min(w, h) * FACE_PAD)
    fh, fw = frame_bgr.shape[:2]
    x1 = max(0, x - pad)
    y1 = max(0, y - pad)
    x2 = min(fw, x + w + pad)
    y2 = min(fh, y + h + pad)
    return frame_bgr[y1:y2, x1:x2], (x1, y1, x2, y2)


def resize_input(face_bgr):
    """Face crop -> IMG_SIZE x IMG_SIZE BGR uint8. What gets written to disk."""
    return cv2.resize(face_bgr, (IMG_SIZE, IMG_SIZE))


def preprocess(face_bgr):
    """Face crop -> (1, IMG_SIZE, IMG_SIZE, 3) float32, MobileNetV2-normalised.

    BGR in (OpenCV's order, what both cv2.imread and VideoCapture produce), RGB
    out, because that is the order MobileNetV2's ImageNet weights expect.
    """
    from tensorflow.keras.applications.mobilenet_v2 import preprocess_input

    img = cv2.cvtColor(face_bgr, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (IMG_SIZE, IMG_SIZE))
    img = preprocess_input(img.astype(np.float32))
    return np.expand_dims(img, axis=0)
