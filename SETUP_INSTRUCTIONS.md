# Setup Instructions
## Ecoproof Backend - Quick Setup Guide

---

## 🔑 Google Gemini API Key

Your Google Cloud Project Details:
- **Project Name:** recycleproof
- **Project ID:** 886282286894
- **Project Number:** 886282286894

### Getting Your API Key

1. Go to: https://aistudio.google.com/app/apikey
2. Sign in with your Google account
3. Select project: **recycleproof** (or create new)
4. Click "Create API Key"
5. Copy the API key

### Adding API Key to Project

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Open `.env` and add your API key:
   ```env
   GEMINI_API_KEY=AIzaSyDgPeZIQUouwbj0dqTCGLO_ejP6rMKa_4c
   ```

3. **IMPORTANT:** Never commit `.env` to git (it's in `.gitignore`)

---

## 📦 Installation Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
# Copy example file
cp .env.example .env

# Edit .env and add:
# - GEMINI_API_KEY (from above)
# - DATABASE_URL (your Neon PostgreSQL URL)
# - JWT_SECRET (generate a random string)
# - SUPABASE_S3_* credentials
```

### 3. Database Setup

```bash
# Generate migration (first time)
npm run migration:generate -- -n InitialMigration

# Run migrations
npm run migration:run
```

### 4. Start Development Server

```bash
npm run start:dev
```

Server will run on: http://localhost:3000

---

## ✅ Verification

### Check Health

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "checks": {
    "database": "healthy",
    "ai": [
      { "provider": "gemini", "healthy": true }
    ]
  }
}
```

### Test API Documentation

Visit: http://localhost:3000/api/docs

---

## 🔒 Security Notes

1. **Never commit `.env` file** - It contains sensitive keys
2. **Rotate API keys** if exposed
3. **Use strong JWT_SECRET** in production
4. **Restrict CORS_ORIGIN** to your app domains

---

## 🚀 Production Deployment

1. Set `NODE_ENV=production`
2. Use strong secrets for JWT
3. Configure proper CORS origins
4. Set up database backups
5. Monitor API usage (Gemini free tier limits)

---

## 📊 Gemini API Limits (Free Tier)

- **60 requests per minute**
- **1,500 requests per day**
- Automatic fallback to Ollama if limit exceeded

---

## 🆘 Troubleshooting

### API Key Invalid
- Verify key at: https://aistudio.google.com/app/apikey
- Check project permissions
- Ensure API is enabled

### Database Connection Failed
- Verify DATABASE_URL format
- Check SSL settings
- Test connection with psql

### AI Verification Not Working
- Check GEMINI_API_KEY in .env
- Verify Ollama is running (if using fallback)
- Check health endpoint: `/health`

---

Ready to start! 🎉
