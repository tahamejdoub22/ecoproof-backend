# Mobile Object Detection Integration Guide

## 🎯 Overview

This guide explains how to integrate object detection in your mobile app to work seamlessly with the backend verification system.

---

## 📋 Required Data from Mobile App

### 1. Object Detection Metadata

```typescript
{
  objectType: 'cardboard' | 'glass' | 'metal' | 'paper' | 'plastic', // Must match Roboflow classes
  confidence: number,        // 0.80 - 1.0 (minimum 80%)
  boundingBoxAreaRatio: number, // 0.25 - 1.0 (minimum 25% of image)
  frameCountDetected: number,   // 4 - 5 (minimum 4 frames)
  motionScore: number,         // 0.3 - 1.0 (minimum 30%)
}
```

### 2. Frame Metadata (Array)

```typescript
frameMetadata: [
  {
    frameIndex: 0,
    timestamp: 1234567890123,  // Unix timestamp in milliseconds
    confidence: 0.85,
    boundingBox: {
      x: 100,      // Top-left X coordinate
      y: 150,      // Top-left Y coordinate
      width: 200,  // Bounding box width
      height: 250  // Bounding box height
    }
  },
  // ... at least 4 frames
]
```

### 3. Image Metadata

```typescript
imageMetadata: {
  width: 1920,      // Image width (640-4096px)
  height: 1080,     // Image height (480-4096px)
  format: 'jpeg',   // 'jpeg' or 'png'
  capturedAt: 1234567890123  // Unix timestamp in milliseconds
}
```

### 4. Image Hashes

```typescript
{
  imageHash: 'sha256_hash_here',      // SHA-256 hash of image
  perceptualHash: 'pHash_hex_here'    // Perceptual hash (pHash) for similarity detection
}
```

---

## ✅ Validation Requirements

### Object Detection Requirements

| Field | Minimum | Maximum | Description |
|-------|---------|---------|-------------|
| `confidence` | **0.80** (80%) | 1.0 | Detection confidence from ML model |
| `boundingBoxAreaRatio` | **0.25** (25%) | 1.0 | Object must fill at least 25% of image |
| `frameCountDetected` | **4** | 5 | At least 4 frames must detect the object |
| `motionScore` | **0.30** (30%) | 1.0 | Minimum motion detected between frames |

### Frame Sequence Requirements

1. **Frame Window**: All frames must be captured within **2 seconds**
2. **Frame Gaps**: Maximum gap between consecutive frames is **500ms**
3. **Bounding Box Consistency**: Standard deviation of bounding box positions must be **< 0.2**

### Image Requirements

1. **Dimensions**: 
   - Width: 640px - 4096px
   - Height: 480px - 4096px
2. **Format**: JPEG or PNG only
3. **Uniqueness**: 
   - SHA-256 hash must be unique (exact duplicate detection)
   - Perceptual hash Hamming distance must be **> 5** from all previous images

---

## 🔧 Implementation Tips

### 1. Multi-Frame Capture

```dart
// Flutter example
List<FrameData> captureFrames() async {
  final frames = <FrameData>[];
  final startTime = DateTime.now().millisecondsSinceEpoch;
  
  for (int i = 0; i < 5; i++) {
    final frame = await captureFrame();
    if (frame.confidence >= 0.80) {
      frames.add(FrameData(
        frameIndex: i,
        timestamp: DateTime.now().millisecondsSinceEpoch,
        confidence: frame.confidence,
        boundingBox: frame.boundingBox,
      ));
    }
    
    // Ensure frames are captured quickly
    await Future.delayed(Duration(milliseconds: 200));
  }
  
  // Ensure all frames within 2 seconds
  final duration = DateTime.now().millisecondsSinceEpoch - startTime;
  if (duration > 2000) {
    throw Exception('Frames captured over too long a period');
  }
  
  if (frames.length < 4) {
    throw Exception('Not enough frames detected');
  }
  
  return frames;
}
```

### 2. Motion Detection

```dart
double calculateMotionScore(List<FrameData> frames) {
  if (frames.length < 2) return 0.0;
  
  double totalMotion = 0.0;
  for (int i = 1; i < frames.length; i++) {
    final prev = frames[i - 1].boundingBox;
    final curr = frames[i].boundingBox;
    
    // Calculate center point movement
    final prevCenterX = prev.x + prev.width / 2;
    final prevCenterY = prev.y + prev.height / 2;
    final currCenterX = curr.x + curr.width / 2;
    final currCenterY = curr.y + curr.height / 2;
    
    final distance = sqrt(
      pow(currCenterX - prevCenterX, 2) + 
      pow(currCenterY - prevCenterY, 2)
    );
    
    // Normalize by image size
    final normalizedMotion = distance / max(imageWidth, imageHeight);
    totalMotion += normalizedMotion;
  }
  
  return min(totalMotion / (frames.length - 1), 1.0);
}
```

### 3. Bounding Box Area Ratio

```dart
double calculateBoundingBoxAreaRatio(BoundingBox box, int imageWidth, int imageHeight) {
  final boxArea = box.width * box.height;
  final imageArea = imageWidth * imageHeight;
  return boxArea / imageArea;
}
```

### 4. Image Hashing

```dart
// SHA-256 Hash
String calculateImageHash(Uint8List imageBytes) {
  final hash = sha256.convert(imageBytes);
  return hash.toString();
}

// Perceptual Hash (pHash)
String calculatePerceptualHash(Image image) {
  // Use a pHash library like imagehash
  // Returns 64-character hex string
  return pHash(image);
}
```

---

## 📱 Error Handling

### Backend Response Format

**Success:**
```json
{
  "success": true,
  "data": {
    "verified": true,
    "actionId": "...",
    "status": "VERIFIED",
    "points": 15
  }
}
```

**Failure with Details:**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Object detection confidence is too low",
    "details": {
      "fields": [
        {
          "field": "confidence",
          "message": "confidence must be >= 0.80"
        }
      ]
    }
  }
}
```

**Verification Failure:**
```json
{
  "success": true,
  "data": {
    "verified": false,
    "reason": "Verification score 82.3% is below required 85%",
    "details": {
      "objectDetection": {
        "passed": true,
        "confidence": 0.85,
        "boundingBoxArea": 0.30,
        "frameCount": 4,
        "motionScore": 0.35
      },
      "location": {
        "passed": true,
        "distance": 5.2,
        "gpsAccuracy": 12.5
      },
      "aiVerification": {
        "passed": false,
        "confidence": 0.65,
        "issues": ["AI verification score too low"]
      }
    },
    "suggestions": [
      "Try: Ensure object is clearly visible and well-lit",
      "Try: Keep camera steady during capture"
    ]
  }
}
```

---

## 🎯 Best Practices

### 1. Pre-Validation on Mobile

Validate all requirements **before** sending to backend:

```dart
bool validateBeforeSubmit(DetectionData data) {
  // Check confidence
  if (data.confidence < 0.80) {
    showError('Confidence too low. Please ensure object is clearly visible.');
    return false;
  }
  
  // Check bounding box
  if (data.boundingBoxAreaRatio < 0.25) {
    showError('Object too small. Please move closer.');
    return false;
  }
  
  // Check frame count
  if (data.frameCountDetected < 4) {
    showError('Not enough frames. Please keep camera steady.');
    return false;
  }
  
  // Check motion
  if (data.motionScore < 0.30) {
    showError('Not enough motion. Please move camera slightly.');
    return false;
  }
  
  return true;
}
```

### 2. Real-Time Feedback

Show real-time feedback during capture:

```dart
Widget buildCaptureOverlay() {
  return Column(
    children: [
      if (currentConfidence < 0.80)
        WarningBanner('Confidence: ${(currentConfidence * 100).toInt()}% - Move closer'),
      if (currentBoundingBoxArea < 0.25)
        WarningBanner('Object too small - Move closer'),
      if (frameCount < 4)
        InfoBanner('Frames: $frameCount/4 - Keep camera steady'),
      if (motionScore < 0.30)
        WarningBanner('Motion too low - Move camera slightly'),
    ],
  );
}
```

### 3. Retry Logic

```dart
Future<SubmitResult> submitWithRetry(DetectionData data, {int maxRetries = 3}) async {
  for (int attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      final result = await api.submitAction(data);
      if (result.verified) {
        return result;
      }
      
      // Show suggestions from backend
      if (result.suggestions != null) {
        showSuggestions(result.suggestions);
      }
      
      // If not last attempt, wait before retry
      if (attempt < maxRetries) {
        await Future.delayed(Duration(seconds: 2));
      }
    } catch (e) {
      if (attempt == maxRetries) rethrow;
    }
  }
  
  throw Exception('Failed after $maxRetries attempts');
}
```

---

## 📊 Validation Checklist

Before submitting, ensure:

- [ ] `confidence >= 0.80` (80%)
- [ ] `boundingBoxAreaRatio >= 0.25` (25%)
- [ ] `frameCountDetected >= 4`
- [ ] `motionScore >= 0.30` (30%)
- [ ] All frames within 2-second window
- [ ] Frame gaps <= 500ms
- [ ] Bounding box positions consistent (std dev < 0.2)
- [ ] Image dimensions: 640-4096px width, 480-4096px height
- [ ] Image format: JPEG or PNG
- [ ] Image hash calculated correctly
- [ ] Perceptual hash calculated correctly
- [ ] GPS coordinates valid
- [ ] GPS accuracy <= 20m
- [ ] Object type matches Roboflow classes exactly

---

## 🐛 Common Issues

### Issue: "Confidence too low"
**Solution:** 
- Ensure good lighting
- Move closer to object
- Keep object in focus
- Clean camera lens

### Issue: "Bounding box too small"
**Solution:**
- Move closer to object
- Ensure object fills at least 25% of frame
- Use zoom if needed

### Issue: "Not enough frames"
**Solution:**
- Keep camera steady
- Ensure object visible throughout capture
- Capture at least 4 frames

### Issue: "Motion score too low"
**Solution:**
- Move camera slightly while capturing
- Don't keep camera completely still
- Ensure slight movement between frames

### Issue: "Frame window too long"
**Solution:**
- Capture all frames quickly
- Complete capture within 2 seconds
- Reduce delay between frames

### Issue: "Bounding box inconsistent"
**Solution:**
- Keep camera steady
- Don't move object during capture
- Ensure object stays in same position

---

## 📚 Additional Resources

- [Object Detection Guide](./OBJECT_DETECTION_GUIDE.md) - Complete implementation guide
- [API Documentation](./README.md#api-documentation) - Full API reference
- [Mobile API Improvements](./MOBILE_API_IMPROVEMENTS.md) - API optimization guide

---

**Last Updated:** 2024-01-15

