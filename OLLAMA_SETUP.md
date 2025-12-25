# Ollama AI Verification Setup Guide
## Free Local AI for Image Verification

---

## 🎯 Overview

Ollama provides **100% free, local AI models** for image verification. This adds an additional anti-cheat layer by having the backend independently verify what the mobile app claims to detect.

---

## 📦 Installation

### Option 1: Docker (Recommended)

```bash
# Pull Ollama Docker image
docker pull ollama/ollama

# Run Ollama container
docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama

# Pull LLaVA model (vision-language model)
docker exec -it ollama ollama pull llava
```

### Option 2: Native Installation

**Linux/macOS:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
ollama pull llava
```

**Windows:**
1. Download from: https://ollama.ai/download
2. Install and run
3. Open terminal: `ollama pull llava`

---

## 🚀 Quick Start

```bash
# Start Ollama server
ollama serve

# Test with an image
ollama run llava "What do you see in this image?" --image path/to/image.jpg
```

---

## 🔧 Backend Integration

### Environment Variables

```env
# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llava
OLLAMA_TIMEOUT=30000  # 30 seconds
OLLAMA_ENABLED=true
```

### API Endpoint

Ollama provides a REST API:

```
POST http://localhost:11434/api/generate
Content-Type: application/json

{
  "model": "llava",
  "prompt": "Analyze this image...",
  "images": ["base64_encoded_image"],
  "stream": false,
  "format": "json"
}
```

---

## 📝 Prompt Engineering

### Recommended Prompt Template

```
You are an expert recycling verification system. Analyze this image carefully.

Task:
1. Identify the object type. It must be one of: plastic_bottle, aluminum_can, glass_bottle, paper, cardboard
2. Rate your confidence (0.0 to 1.0)
3. Determine if the image is authentic (not edited, not a screenshot, not AI-generated)
4. Assess image quality (good/fair/poor)

Respond in JSON format:
{
  "object_type": "plastic_bottle",
  "confidence": 0.92,
  "authentic": true,
  "quality": "good",
  "reasoning": "I can clearly see a plastic bottle..."
}

Image analysis:
```

### Alternative Prompts

**Strict Verification:**
```
Analyze this recycling image. Verify:
- Object type (must match: plastic_bottle, aluminum_can, glass_bottle, paper, cardboard)
- Is it clearly visible?
- Is the image authentic (not fake/edited)?
- Confidence level (0-1)

JSON response required.
```

**Detailed Analysis:**
```
Examine this image for recycling verification.

Questions:
1. What recycling material is shown? (plastic_bottle, aluminum_can, glass_bottle, paper, cardboard)
2. How confident are you? (0.0-1.0)
3. Is this a real photo or manipulated? (true/false)
4. Is the object clearly visible? (good/fair/poor)
5. Any signs of fraud? (none/suspicious/manipulated)

Respond as JSON.
```

---

## 🎨 Model Options

### LLaVA Models

| Model | Size | Speed | Accuracy | Recommended |
|-------|------|-------|----------|-------------|
| llava:7b | ~4GB | Fast | Good | ✅ Development |
| llava:13b | ~7GB | Medium | Better | ✅ Production |
| llava:34b | ~20GB | Slow | Best | ⚠️ If resources allow |

### Other Vision Models

- `bakllava` - Alternative vision model
- `llava-phi3` - Smaller, faster variant

---

## ⚡ Performance Optimization

### 1. Model Quantization

```bash
# Use quantized models (smaller, faster)
ollama pull llava:7b-q4_0  # 4-bit quantization
```

### 2. Batch Processing

Process multiple images in one request (if supported by model).

### 3. Caching

Cache AI responses for similar images (based on perceptual hash).

### 4. Async Processing

Run AI verification asynchronously to avoid blocking requests.

---

## 🔒 Security Considerations

1. **Local Only**: Ollama runs locally, no data leaves your server
2. **No API Keys**: Completely free, no external services
3. **Privacy**: Images never sent to third parties
4. **Rate Limiting**: Implement rate limiting on Ollama requests

---

## 🐛 Troubleshooting

### Model Not Found
```bash
ollama pull llava
```

### Out of Memory
- Use smaller model (llava:7b)
- Reduce batch size
- Add more RAM or use GPU

### Slow Responses
- Use quantized model
- Enable GPU acceleration
- Reduce image resolution before sending

### Connection Errors
```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Restart Ollama
docker restart ollama
# or
ollama serve
```

---

## 📊 Monitoring

### Health Check

```bash
curl http://localhost:11434/api/tags
```

### Performance Metrics

Track:
- Response time
- Success rate
- Model accuracy
- Resource usage (CPU/GPU/Memory)

---

## 🚀 Production Deployment

### Docker Compose

```yaml
version: '3.8'
services:
  ollama:
    image: ollama/ollama
    volumes:
      - ollama_data:/root/.ollama
    ports:
      - "11434:11434"
    deploy:
      resources:
        limits:
          memory: 8G
        reservations:
          memory: 4G

volumes:
  ollama_data:
```

### Systemd Service (Linux)

```ini
[Unit]
Description=Ollama AI Service
After=network.target

[Service]
ExecStart=/usr/local/bin/ollama serve
Restart=always
User=ollama
Group=ollama

[Install]
WantedBy=multi-user.target
```

---

## 📚 Resources

- Official Docs: https://ollama.ai
- LLaVA Paper: https://arxiv.org/abs/2304.08485
- GitHub: https://github.com/ollama/ollama
- Model Library: https://ollama.ai/library

---

## ✅ Checklist

- [ ] Ollama installed and running
- [ ] LLaVA model downloaded
- [ ] API endpoint accessible
- [ ] Environment variables configured
- [ ] Health check working
- [ ] Performance tested
- [ ] Error handling implemented
- [ ] Monitoring set up

---

This setup provides **free, local, privacy-preserving AI verification** for your recycling platform!
