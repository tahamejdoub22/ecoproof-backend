/**
 * User-friendly validation messages for mobile apps
 */
export const ValidationMessages = {
  // Object Detection
  CONFIDENCE_TOO_LOW:
    "Object detection confidence is too low. Please ensure the object is clearly visible and well-lit.",
  BOUNDING_BOX_TOO_SMALL:
    "The detected object is too small in the image. Please move closer or ensure the object fills more of the frame.",
  INSUFFICIENT_FRAMES:
    "Not enough frames detected. Please keep the camera steady and ensure the object is visible for at least 4 frames.",
  MOTION_TOO_LOW:
    "Not enough motion detected. Please move the camera slightly while capturing.",

  // Location
  GPS_ACCURACY_TOO_LOW:
    "GPS accuracy is too low. Please wait for better GPS signal or move to an open area.",
  TOO_FAR_FROM_POINT:
    "You are too far from the recycling point. Please move closer to the designated location.",
  MATERIAL_NOT_ALLOWED:
    "This material type is not accepted at this recycling point. Please check the point details.",
  IMPOSSIBLE_SPEED:
    "Location change detected that is not physically possible. Please ensure GPS is accurate.",
  IMPOSSIBLE_JUMP:
    "Impossible location jump detected. Please ensure you are at the correct location.",

  // Image
  DUPLICATE_IMAGE:
    "This image has already been submitted. Please capture a new image.",
  IMAGE_TOO_SIMILAR:
    "This image is too similar to a previous submission. Please capture a new, different image.",
  IMAGE_HASH_MISMATCH: "Image verification failed. Please try uploading again.",
  INVALID_IMAGE_FORMAT: "Invalid image format. Please use JPEG or PNG.",
  INVALID_IMAGE_SIZE:
    "Image dimensions are invalid. Please ensure width is 640-4096px and height is 480-4096px.",

  // Frame Sequence
  FRAME_WINDOW_TOO_LONG:
    "Frames were captured over too long a period. Please capture all frames within 2 seconds.",
  FRAME_GAP_TOO_LARGE:
    "Gap between frames is too large. Please capture frames continuously.",
  BOUNDING_BOX_INCONSISTENT:
    "Object position changed too much between frames. Please keep the camera steady.",

  // General
  VERIFICATION_FAILED:
    "Verification failed. Please check all requirements and try again.",
  TRUST_SCORE_TOO_LOW:
    "Your account trust score is too low. Please contact support.",
};

export const ValidationHints = {
  CONFIDENCE_TOO_LOW: "Try: Better lighting, closer distance, clearer object",
  BOUNDING_BOX_TOO_SMALL:
    "Try: Move closer to the object, ensure it fills 25%+ of frame",
  INSUFFICIENT_FRAMES:
    "Try: Keep camera steady, ensure object visible for 4+ frames",
  MOTION_TOO_LOW: "Try: Slight camera movement while capturing",
  GPS_ACCURACY_TOO_LOW: "Try: Wait for GPS lock, move to open area",
  TOO_FAR_FROM_POINT: "Try: Move closer to the recycling point marker",
};
