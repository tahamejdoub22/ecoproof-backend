# Object Detection Implementation Guide
## Mobile App (Flutter/React Native) - On-Device ML

---

## 🎯 OVERVIEW

This guide provides **complete, free, production-ready** tools and implementation for object detection on mobile devices. The backend does NOT perform object detection—it only verifies the metadata sent by the mobile app.

---

## 🛠️ RECOMMENDED TOOLS & FRAMEWORKS

### Option 1: TensorFlow Lite (RECOMMENDED) ⭐

**Why TensorFlow Lite:**
- ✅ 100% Free and open-source
- ✅ Optimized for mobile (small model size, fast inference)
- ✅ Cross-platform (Flutter & React Native)
- ✅ Pre-trained models available
- ✅ Custom model training support
- ✅ Active community and documentation

**Resources:**
- Official: https://www.tensorflow.org/lite
- Models: https://www.tensorflow.org/lite/models
- Flutter Plugin: `tflite_flutter` (pub.dev)
- React Native: `@tensorflow/tfjs-react-native` + `react-native-fast-image`

---

### Option 2: MediaPipe (Google)

**Why MediaPipe:**
- ✅ Free and open-source
- ✅ Pre-built solutions for object detection
- ✅ Excellent performance
- ✅ Cross-platform

**Resources:**
- Official: https://mediapipe.dev
- Flutter: `mediapipe` package
- React Native: Custom bridge or use TensorFlow Lite

---

### Option 3: ONNX Runtime Mobile

**Why ONNX:**
- ✅ Free and open-source
- ✅ Model format agnostic
- ✅ Good performance
- ✅ Cross-platform

**Resources:**
- Official: https://onnxruntime.ai
- Flutter: `onnxruntime` package
- React Native: `onnxruntime-react-native`

---

## 🏆 RECOMMENDED: TensorFlow Lite Implementation

### Step 1: Choose a Pre-trained Model

**Recommended Models for Recycling Objects:**

#### Option A: COCO SSD MobileNet V2 (General Purpose)
- **Model:** `ssd_mobilenet_v2_coco`
- **Size:** ~6.7 MB
- **Speed:** ~30ms inference on mid-range device
- **Accuracy:** Good for general objects
- **Classes:** Includes "bottle" (covers plastic/glass)
- **Download:** https://www.tensorflow.org/lite/models/object_detection/overview

#### Option B: Custom Fine-tuned Model (BEST)
- **Base:** MobileNet V2 or EfficientNet-Lite
- **Fine-tune on:** Custom recycling dataset
- **Classes:** plastic_bottle, aluminum_can, glass_bottle, paper, cardboard
- **Size:** ~8-12 MB
- **Accuracy:** Highest (trained on recycling-specific data)

#### Option C: YOLOv5 Nano (via TensorFlow Lite)
- **Model:** YOLOv5n converted to TFLite
- **Size:** ~3.5 MB
- **Speed:** ~20ms inference
- **Accuracy:** Excellent
- **Note:** Requires conversion from PyTorch to TFLite

---

### Step 2: Model Training (Custom Model - RECOMMENDED)

**Free Tools for Training:**

1. **Google Colab (Free GPU)**
   - Jupyter notebook environment
   - Free GPU access (limited hours)
   - Pre-installed TensorFlow

2. **TensorFlow Model Maker**
   - Transfer learning tool
   - Easy fine-tuning
   - Export to TFLite

3. **Roboflow (Free Tier)**
   - Dataset management
   - Augmentation
   - Export formats

**Training Steps:**

```python
# 1. Collect Dataset
# - Images of plastic bottles, cans, glass, paper, cardboard
# - Minimum 100 images per class (more = better)
# - Diverse lighting, angles, backgrounds

# 2. Annotate Dataset
# - Use LabelImg (free) or Roboflow
# - Bounding boxes for each object
# - Export as COCO or Pascal VOC format

# 3. Train Model (Google Colab example)
!pip install tensorflow tensorflow-hub

import tensorflow as tf
from tensorflow import keras

# Load base model
base_model = tf.keras.applications.MobileNetV2(
    input_shape=(320, 320, 3),
    include_top=False,
    weights='imagenet'
)

# Add detection head
# ... (object detection architecture)

# Train
model.compile(optimizer='adam', loss='...')
model.fit(train_dataset, epochs=50, validation_data=val_dataset)

# 4. Convert to TFLite
converter = tf.lite.TFLiteConverter.from_keras_model(model)
converter.optimizations = [tf.lite.Optimize.DEFAULT]
tflite_model = converter.convert()

# Save
with open('recycling_model.tflite', 'wb') as f:
    f.write(tflite_model)
```

**Free Datasets:**
- Open Images Dataset (Google)
- COCO Dataset
- Custom collection (your own photos)

---

### Step 3: Flutter Implementation

**Dependencies (`pubspec.yaml`):**

```yaml
dependencies:
  flutter:
    sdk: flutter
  tflite_flutter: ^0.10.4
  image_picker: ^0.8.7
  camera: ^0.10.5
  path_provider: ^2.1.1
  crypto: ^3.0.3
  image: ^4.1.3  # For image processing
```

**Implementation:**

```dart
// lib/services/object_detection_service.dart
import 'dart:io';
import 'dart:typed_data';
import 'package:tflite_flutter/tflite_flutter.dart';
import 'package:image/image.dart' as img;
import 'package:crypto/crypto.dart';
import 'dart:convert';

class ObjectDetectionService {
  Interpreter? _interpreter;
  List<String>? _labels;
  
  // Allowed classes
  static const Map<String, int> classMap = {
    'plastic_bottle': 0,
    'aluminum_can': 1,
    'glass_bottle': 2,
    'paper': 3,
    'cardboard': 4,
  };
  
  Future<void> loadModel() async {
    try {
      // Load model from assets
      _interpreter = await Interpreter.fromAsset('recycling_model.tflite');
      
      // Load labels
      final labelData = await rootBundle.loadString('assets/labels.txt');
      _labels = labelData.split('\n');
      
      print('Model loaded successfully');
    } catch (e) {
      print('Error loading model: $e');
      rethrow;
    }
  }
  
  Future<DetectionResult> detectObject(File imageFile) async {
    if (_interpreter == null) {
      await loadModel();
    }
    
    // Load and preprocess image
    final imageBytes = await imageFile.readAsBytes();
    final image = img.decodeImage(imageBytes);
    
    if (image == null) {
      throw Exception('Failed to decode image');
    }
    
    // Resize to model input size (e.g., 320x320)
    final resized = img.copyResize(image, width: 320, height: 320);
    
    // Convert to input format (normalized 0-1)
    final input = _preprocessImage(resized);
    
    // Run inference
    final output = List.filled(1 * 10 * 4, 0.0).reshape([1, 10, 4]);
    final scores = List.filled(1 * 10, 0.0).reshape([1, 10]);
    final classes = List.filled(1 * 10, 0.0).reshape([1, 10]);
    final numDetections = List.filled(1, 0.0).reshape([1]);
    
    _interpreter!.run({
      0: input,
    }, {
      0: output,
      1: scores,
      2: classes,
      3: numDetections,
    });
    
    // Process results
    return _processResults(output, scores, classes, numDetections[0], image);
  }
  
  List<List<double>> _preprocessImage(img.Image image) {
    final inputBuffer = List.generate(
      1 * 320 * 320 * 3,
      (index) => 0.0,
    ).reshape([1, 320, 320, 3]);
    
    for (int y = 0; y < 320; y++) {
      for (int x = 0; x < 320; x++) {
        final pixel = image.getPixel(x, y);
        inputBuffer[0][y][x][0] = (pixel.r / 255.0);
        inputBuffer[0][y][x][1] = (pixel.g / 255.0);
        inputBuffer[0][y][x][2] = (pixel.b / 255.0);
      }
    }
    
    return inputBuffer;
  }
  
  DetectionResult _processResults(
    List<List<List<List<double>>>> output,
    List<List<double>> scores,
    List<List<double>> classes,
    double numDetections,
    img.Image originalImage,
  ) {
    final detections = <Detection>[];
    final imageWidth = originalImage.width;
    final imageHeight = originalImage.height;
    
    for (int i = 0; i < numDetections.toInt(); i++) {
      final score = scores[0][i];
      final classIndex = classes[0][i].toInt();
      
      if (score < 0.5) continue; // Filter low confidence
      
      final box = output[0][i];
      final yMin = box[0];
      final xMin = box[1];
      final yMax = box[2];
      final xMax = box[3];
      
      // Convert to image coordinates
      final left = (xMin * imageWidth).toInt();
      final top = (yMin * imageHeight).toInt();
      final right = (xMax * imageWidth).toInt();
      final bottom = (yMax * imageHeight).toInt();
      
      final width = right - left;
      final height = bottom - top;
      final area = width * height;
      final imageArea = imageWidth * imageHeight;
      final areaRatio = area / imageArea;
      
      // Map class index to our class names
      final className = _labels?[classIndex] ?? 'unknown';
      final mappedClass = _mapClass(className);
      
      if (mappedClass != null && areaRatio >= 0.25) {
        detections.add(Detection(
          className: mappedClass,
          confidence: score,
          boundingBox: BoundingBox(left, top, width, height),
          areaRatio: areaRatio,
        ));
      }
    }
    
    // Return best detection
    if (detections.isEmpty) {
      return DetectionResult.noDetection();
    }
    
    detections.sort((a, b) => b.confidence.compareTo(a.confidence));
    return DetectionResult.fromDetection(detections.first);
  }
  
  String? _mapClass(String className) {
    // Map model classes to our classes
    if (className.toLowerCase().contains('bottle')) {
      return 'plastic_bottle'; // Or detect glass vs plastic
    } else if (className.toLowerCase().contains('can')) {
      return 'aluminum_can';
    } else if (className.toLowerCase().contains('paper')) {
      return 'paper';
    } else if (className.toLowerCase().contains('cardboard')) {
      return 'cardboard';
    }
    return null;
  }
  
  void dispose() {
    _interpreter?.close();
  }
}

class Detection {
  final String className;
  final double confidence;
  final BoundingBox boundingBox;
  final double areaRatio;
  
  Detection({
    required this.className,
    required this.confidence,
    required this.boundingBox,
    required this.areaRatio,
  });
}

class BoundingBox {
  final int x;
  final int y;
  final int width;
  final int height;
  
  BoundingBox(this.x, this.y, this.width, this.height);
}

class DetectionResult {
  final String? objectType;
  final double confidence;
  final double boundingBoxAreaRatio;
  
  DetectionResult({
    this.objectType,
    required this.confidence,
    required this.boundingBoxAreaRatio,
  });
  
  factory DetectionResult.fromDetection(Detection detection) {
    return DetectionResult(
      objectType: detection.className,
      confidence: detection.confidence,
      boundingBoxAreaRatio: detection.areaRatio,
    );
  }
  
  factory DetectionResult.noDetection() {
    return DetectionResult(
      objectType: null,
      confidence: 0.0,
      boundingBoxAreaRatio: 0.0,
    );
  }
  
  bool get hasDetection => objectType != null && confidence >= 0.80;
}
```

---

### Step 4: Multi-Frame Capture & Motion Detection

```dart
// lib/services/multi_frame_capture.dart
import 'dart:async';
import 'dart:io';
import 'package:camera/camera.dart';
import 'package:image/image.dart' as img;

class MultiFrameCaptureService {
  final ObjectDetectionService detectionService;
  final CameraController cameraController;
  
  MultiFrameCaptureService({
    required this.detectionService,
    required this.cameraController,
  });
  
  Future<MultiFrameResult> captureFrames() async {
    final frames = <FrameData>[];
    final startTime = DateTime.now();
    
    // Capture 5 frames over ~2 seconds
    for (int i = 0; i < 5; i++) {
      final image = await cameraController.takePicture();
      final imageFile = File(image.path);
      
      // Run detection
      final result = await detectionService.detectObject(imageFile);
      
      if (result.hasDetection) {
        final imageData = img.decodeImage(await imageFile.readAsBytes());
        frames.add(FrameData(
          index: i,
          timestamp: DateTime.now().millisecondsSinceEpoch,
          confidence: result.confidence,
          boundingBox: _extractBoundingBox(imageData!, result),
          imageFile: imageFile,
        ));
      }
      
      // Wait 400ms between frames
      if (i < 4) {
        await Future.delayed(Duration(milliseconds: 400));
      }
    }
    
    // Calculate motion score
    final motionScore = _calculateMotionScore(frames);
    
    // Check consistency
    final objectType = frames.first.objectType;
    final allSameType = frames.every((f) => f.objectType == objectType);
    final frameCount = frames.length;
    
    return MultiFrameResult(
      frames: frames,
      objectType: objectType,
      frameCountDetected: frameCount,
      motionScore: motionScore,
      isConsistent: allSameType && frameCount >= 4,
    );
  }
  
  double _calculateMotionScore(List<FrameData> frames) {
    if (frames.length < 2) return 0.0;
    
    double totalMovement = 0.0;
    for (int i = 1; i < frames.length; i++) {
      final prev = frames[i - 1].boundingBox;
      final curr = frames[i].boundingBox;
      
      final dx = (curr.x - prev.x).abs();
      final dy = (curr.y - prev.y).abs();
      final movement = (dx + dy) / 100.0; // Normalize
      
      totalMovement += movement;
    }
    
    return (totalMovement / (frames.length - 1)).clamp(0.0, 1.0);
  }
  
  BoundingBox _extractBoundingBox(img.Image image, DetectionResult result) {
    // Extract bounding box from detection
    // This is simplified - actual implementation depends on model output
    return BoundingBox(0, 0, image.width, image.height);
  }
}

class FrameData {
  final int index;
  final int timestamp;
  final double confidence;
  final BoundingBox boundingBox;
  final File imageFile;
  final String? objectType;
  
  FrameData({
    required this.index,
    required this.timestamp,
    required this.confidence,
    required this.boundingBox,
    required this.imageFile,
    this.objectType,
  });
}

class MultiFrameResult {
  final List<FrameData> frames;
  final String? objectType;
  final int frameCountDetected;
  final double motionScore;
  final bool isConsistent;
  
  MultiFrameResult({
    required this.frames,
    this.objectType,
    required this.frameCountDetected,
    required this.motionScore,
    required this.isConsistent,
  });
}
```

---

### Step 5: Image Hashing

```dart
// lib/services/image_hash_service.dart
import 'dart:io';
import 'dart:typed_data';
import 'package:crypto/crypto.dart';
import 'package:image/image.dart' as img;
import 'dart:math';

class ImageHashService {
  // SHA-256 hash
  Future<String> calculateSHA256(File imageFile) async {
    final bytes = await imageFile.readAsBytes();
    final hash = sha256.convert(bytes);
    return hash.toString();
  }
  
  // Perceptual hash (pHash) - simplified version
  Future<String> calculatePerceptualHash(File imageFile) async {
    final bytes = await imageFile.readAsBytes();
    final image = img.decodeImage(bytes);
    
    if (image == null) {
      throw Exception('Failed to decode image');
    }
    
    // Resize to 8x8 for hash calculation
    final resized = img.copyResize(image, width: 8, height: 8);
    
    // Convert to grayscale
    final grayscale = img.grayscale(resized);
    
    // Calculate average
    int sum = 0;
    for (int y = 0; y < 8; y++) {
      for (int x = 0; x < 8; x++) {
        final pixel = grayscale.getPixel(x, y);
        sum += pixel.r;
      }
    }
    final average = sum / 64;
    
    // Build hash
    final hash = StringBuffer();
    for (int y = 0; y < 8; y++) {
      for (int x = 0; x < 8; x++) {
        final pixel = grayscale.getPixel(x, y);
        hash.write(pixel.r > average ? '1' : '0');
      }
    }
    
    return hash.toString();
  }
  
  // Calculate Hamming distance between two pHashes
  int hammingDistance(String hash1, String hash2) {
    if (hash1.length != hash2.length) {
      throw Exception('Hash lengths must match');
    }
    
    int distance = 0;
    for (int i = 0; i < hash1.length; i++) {
      if (hash1[i] != hash2[i]) {
        distance++;
      }
    }
    
    return distance;
  }
}
```

---

### Step 6: React Native Implementation

**Dependencies (`package.json`):**

```json
{
  "dependencies": {
    "@tensorflow/tfjs": "^4.10.0",
    "@tensorflow/tfjs-react-native": "^0.8.0",
    "react-native-fs": "^2.20.0",
    "react-native-image-picker": "^5.6.0",
    "react-native-camera": "^4.2.1",
    "crypto-js": "^4.1.1"
  }
}
```

**Implementation (similar structure to Flutter):**

```javascript
// services/ObjectDetectionService.js
import * as tf from '@tensorflow/tfjs';
import {bundleResourceIO} from '@tensorflow/tfjs-react-native';

class ObjectDetectionService {
  constructor() {
    this.model = null;
    this.labels = [];
  }
  
  async loadModel() {
    await tf.ready();
    this.model = await tf.loadLayersModel(
      bundleResourceIO('recycling_model.tflite')
    );
    // Load labels...
  }
  
  async detectObject(imageUri) {
    // Similar implementation to Flutter
    // Use tf.browser.fromPixels() for image processing
  }
}
```

---

## 📊 MODEL PERFORMANCE OPTIMIZATION

### Quantization

```python
# Convert to quantized TFLite (smaller, faster)
converter = tf.lite.TFLiteConverter.from_keras_model(model)
converter.optimizations = [tf.lite.Optimize.DEFAULT]
converter.target_spec.supported_types = [tf.float16]  # or tf.int8
tflite_model = converter.convert()
```

### Model Size Optimization

- Use MobileNet or EfficientNet-Lite backbones
- Reduce input size (320x320 instead of 640x640)
- Quantize to INT8 (4x smaller)
- Use TensorFlow Lite Model Maker for optimization

---

## 🎓 TRAINING RESOURCES (FREE)

1. **TensorFlow Object Detection API Tutorial**
   - https://tensorflow-object-detection-api-tutorial.readthedocs.io

2. **Google Colab Notebooks**
   - Pre-built training notebooks
   - Free GPU access

3. **Roboflow University**
   - Free courses on object detection
   - Dataset management tools

4. **TensorFlow Hub**
   - Pre-trained models for transfer learning
   - https://tfhub.dev

---

## ✅ CHECKLIST FOR MOBILE IMPLEMENTATION

- [ ] Model trained and converted to TFLite
- [ ] Model integrated in mobile app
- [ ] Multi-frame capture implemented (5 frames)
- [ ] Motion detection working
- [ ] Image hashing (SHA-256 + pHash) implemented
- [ ] Bounding box area calculation
- [ ] Confidence threshold filtering (≥ 0.80)
- [ ] Frame sequence validation
- [ ] Error handling for edge cases
- [ ] Performance optimization (model quantization)
- [ ] Testing on real devices

---

## 🔗 USEFUL LINKS

- TensorFlow Lite: https://www.tensorflow.org/lite
- Flutter TFLite: https://pub.dev/packages/tflite_flutter
- React Native TFJS: https://github.com/tensorflow/tfjs/tree/master/tfjs-react-native
- Model Maker: https://www.tensorflow.org/lite/models/modify/model_maker
- COCO Dataset: https://cocodataset.org
- Roboflow: https://roboflow.com

---

This implementation provides a **complete, free, production-ready** object detection system for your mobile app!
