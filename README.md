# Ecoproof Backend ♻️

Ecoproof is a fraud-resistant recycling verification platform designed for cross-platform mobile applications.

This backend acts as a **trust authority**, validating recycling actions using:
- Object detection metadata (from mobile)
- GPS and location validation
- **AI Verification (Google Gemini Vision)** ⭐ NEW
- Anti-cheat logic
- Trust scoring
- Controlled reward calculation

## Tech Stack (100% Free)

- NestJS
- TypeORM
- PostgreSQL (Neon)
- Supabase S3 (private bucket)
- **Google Gemini Vision API** (Free tier - BEST accuracy)
- Ollama (Local AI fallback)
- JWT Authentication
- REST API

## Core Principles

- Object detection runs on-device (mobile)
- Backend never trusts raw client data
- **AI verification adds extra anti-cheat layer** ⭐
- Anti-cheat logic before rewards
- Deterministic, explainable decisions

## Main Features

- User authentication (JWT)
- Recycling point management
- Recycle action verification
- **AI-powered image verification** (Gemini/Ollama)
- Fraud detection
- Trust & reward system
- Admin moderation
- Audit logging

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Get Gemini API Key (Free)

1. Visit: https://aistudio.google.com/app/apikey
2. Create API key (free tier: 60 req/min, 1500/day)
3. Add to `.env`: `GEMINI_API_KEY=your_key_here`

### 4. Setup Database

```bash
# Run migrations
npm run migration:run
```

### 5. Start Server

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## API Documentation

Once running, visit: http://localhost:3000/api/docs

## Environment Variables

See `.env.example` for all required variables.

**Required:**
- `DATABASE_URL` - Neon PostgreSQL connection string
- `JWT_SECRET` - Secret for JWT tokens
- `GEMINI_API_KEY` - Google Gemini API key (get free at https://aistudio.google.com/app/apikey)
- `SUPABASE_S3_*` - Supabase Storage credentials

## Project Structure

```
src/
├── entities/          # TypeORM entities
├── modules/           # Feature modules
│   ├── auth/         # Authentication
│   ├── users/        # User management
│   ├── recycling-points/  # Recycling points
│   ├── recycle-actions/    # Action submission
│   ├── verification/       # Verification logic
│   ├── ai-verification/   # AI verification (Gemini/Ollama)
│   ├── trust/        # Trust scoring
│   ├── rewards/      # Reward calculation
│   ├── fraud/        # Fraud detection
│   ├── audit/        # Audit logging
│   └── storage/      # Image storage
├── common/           # Shared DTOs, utilities
└── config/          # Configuration files
```

## Verification Flow

1. Mobile app submits action with image + metadata
2. Backend validates object detection metadata
3. Backend validates location/GPS
4. **Backend verifies with AI (Gemini)** ⭐
5. Backend calculates verification score
6. If verified → Award points, increase trust
7. If rejected → Decrease trust, check for fraud

## AI Verification

The backend uses **Google Gemini Vision API** (primary) with automatic fallback to Ollama:

- **Gemini**: Best accuracy (~95%), fast (1-3s), free tier available
- **Ollama**: 100% local, privacy-focused, fallback option

See `GEMINI_SETUP.md` for setup instructions.

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register user
- `POST /api/v1/auth/login` - Login
- `POST /api/v1/auth/refresh` - Refresh token

### Recycling Points
- `GET /api/v1/recycling-points` - List all points
- `GET /api/v1/recycling-points/nearest?lat=&lng=` - Find nearest
- `GET /api/v1/recycling-points/:id` - Get point details

### Recycle Actions
- `POST /api/v1/recycle-actions` - Submit action (with image)
- `GET /api/v1/recycle-actions/my-actions` - Get user's actions

### Users
- `GET /api/v1/users/profile` - Get user profile

### Health
- `GET /health` - Health check
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe

## Development

```bash
# Run in development mode
npm run start:dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Configure all environment variables
3. Run database migrations
4. Build: `npm run build`
5. Start: `npm run start:prod`

## Documentation

- `ARCHITECTURE.md` - System architecture
- `LOGIC_REVIEW.md` - Verification logic details
- `GEMINI_SETUP.md` - Gemini AI setup guide
- `OLLAMA_SETUP.md` - Ollama setup (fallback)
- `OBJECT_DETECTION_GUIDE.md` - Mobile app ML guide

## License

MIT