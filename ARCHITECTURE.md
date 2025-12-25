# Backend Architecture Documentation
## Ecoproof Smart Recycling Verification System

---

## 🏗️ SYSTEM ARCHITECTURE OVERVIEW

```
┌─────────────────────────────────────────────────────────────┐
│                    MOBILE APPLICATION                        │
│  (Flutter/React Native - Object Detection on Device)        │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS/REST API
                       │ JWT Authentication
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    API GATEWAY LAYER                         │
│  • Rate Limiting                                             │
│  • CORS & Security Headers                                   │
│  • Request Validation                                        │
│  • Authentication Middleware                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  APPLICATION LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Auth       │  │  Verification │  │   Rewards    │      │
│  │   Module     │  │   Module      │  │   Module     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Trust      │  │    Fraud      │  │    Admin     │      │
│  │   Module     │  │   Module      │  │   Module     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    SERVICE LAYER                             │
│  • Business Logic                                            │
│  • Validation Rules                                          │
│  • Score Calculations                                        │
│  • Fraud Detection                                           │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┬──────────────┐
        ▼              ▼              ▼              ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  PostgreSQL  │ │    Redis     │ │   Supabase   │ │    Ollama    │
│  (Neon)      │ │   (Cache +    │ │   Storage    │ │   (Local AI) │
│  TypeORM     │ │   Jobs)       │ │   (S3)       │ │   (LLaVA)    │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

---

## 📦 MODULE ARCHITECTURE

### Module Dependency Graph

```
Core Modules (No Dependencies):
├── AuthModule
├── UsersModule
└── RecyclingPointsModule

Business Logic Modules:
├── RecycleActionsModule (depends on: Users, RecyclingPoints)
├── VerificationModule (depends on: RecycleActions, Trust, AI)
├── AIVerificationModule (depends on: Storage) ⭐ NEW
├── TrustModule (depends on: Users, RecycleActions)
├── FraudModule (depends on: RecycleActions, Trust, Users)
└── RewardsModule (depends on: RecycleActions, Trust, Users)

Support Modules:
├── AdminModule (depends on: All modules)
└── AuditModule (depends on: All modules)
```

---

## 🔄 REQUEST FLOW: RECYCLE ACTION SUBMISSION

```
1. Mobile App → POST /api/v1/recycle-actions
   ├── Headers: Authorization: Bearer <JWT>
   ├── Body: Action metadata + Image file
   └── Idempotency-Key: <UUID>

2. API Gateway Layer
   ├── Rate Limiting Check
   ├── JWT Validation
   ├── Request Size Validation
   └── CORS Check

3. RecycleActionsController
   ├── Validate DTO (Zod schema)
   ├── Check Idempotency Key (Redis)
   └── Call RecycleActionsService.submit()

4. RecycleActionsService.submit()
   ├── Upload image to Supabase Storage
   ├── Verify image hash matches claimed hash
   ├── Store action in DB (status: PENDING)
   └── Call VerificationService.verify()

5. VerificationService.verify()
   ├── Object Detection Validation
   │   ├── Confidence check
   │   ├── Frame sequence validation
   │   ├── Motion score check
   │   └── Image uniqueness (hash + pHash)
   ├── Location Validation
   │   ├── GPS accuracy check
   │   ├── Distance to recycling point
   │   ├── Speed/jump detection
   │   └── Material match check
   ├── AI Verification (Ollama) ⭐ NEW
   │   ├── Download image from storage
   │   ├── Send to Ollama vision model (LLaVA)
   │   ├── Analyze: object type, authenticity, quality
   │   ├── Compare with mobile claims
   │   └── Generate AI confidence score
   ├── Calculate Verification Score
   │   ├── Component scores (7 factors - includes AI)
   │   └── Weighted sum
   └── Return: VERIFIED or REJECTED

6. If VERIFIED:
   ├── Update action status: VERIFIED
   ├── Call TrustService.increaseTrust()
   ├── Call RewardsService.calculateAndAward()
   └── Call AuditService.log()

7. If REJECTED:
   ├── Update action status: REJECTED
   ├── Call TrustService.decreaseTrust()
   ├── Call FraudService.checkPatterns()
   └── Call AuditService.log()

8. Response to Mobile App
   ├── Status: 200 OK
   ├── Body: { verified: boolean, points?: number, reason?: string }
   └── Headers: X-Idempotency-Key-Used: true
```

---

## 🗄️ DATABASE ARCHITECTURE

### Core Tables

```
users
├── id (UUID, PK)
├── email (string, unique, indexed)
├── password_hash (string)
├── trust_score (decimal, indexed)
├── streak_days (integer)
├── last_action_at (timestamp)
├── device_fingerprint (string)
├── created_at (timestamp)
└── updated_at (timestamp)

recycling_points
├── id (UUID, PK)
├── name (string)
├── latitude (decimal, indexed)
├── longitude (decimal, indexed)
├── radius (integer)
├── altitude (decimal, nullable)
├── allowed_materials (array)
├── multiplier (decimal, default 1.0)
├── is_active (boolean, indexed)
├── created_at (timestamp)
└── updated_at (timestamp)

recycle_actions
├── id (UUID, PK)
├── user_id (UUID, FK → users, indexed)
├── recycling_point_id (UUID, FK → recycling_points, indexed)
├── object_type (enum, indexed)
├── confidence (decimal)
├── image_hash (string, unique, indexed)
├── perceptual_hash (string, indexed)
├── image_url (string)
├── gps_lat (decimal)
├── gps_lng (decimal)
├── gps_accuracy (decimal)
├── verification_score (decimal)
├── status (enum: PENDING, VERIFIED, REJECTED, FLAGGED)
├── points_awarded (integer)
├── idempotency_key (string, unique, indexed)
├── created_at (timestamp, indexed)
└── updated_at (timestamp)

trust_history
├── id (UUID, PK)
├── user_id (UUID, FK → users, indexed)
├── previous_score (decimal)
├── new_score (decimal)
├── change_amount (decimal)
├── reason (string)
├── action_id (UUID, FK → recycle_actions, nullable)
├── created_at (timestamp, indexed)
└── INDEX(user_id, created_at)

rewards
├── id (UUID, PK)
├── user_id (UUID, FK → users, indexed)
├── action_id (UUID, FK → recycle_actions, unique)
├── base_points (integer)
├── location_multiplier (decimal)
├── streak_multiplier (decimal)
├── trust_multiplier (decimal)
├── final_points (integer)
├── created_at (timestamp, indexed)
└── INDEX(user_id, created_at)

audit_logs
├── id (UUID, PK)
├── action_type (enum, indexed)
├── user_id (UUID, FK → users, nullable, indexed)
├── entity_type (string)
├── entity_id (UUID)
├── metadata (jsonb)
├── ip_address (string)
├── user_agent (string)
├── created_at (timestamp, indexed)
└── INDEX(action_type, created_at)
```

### Indexes Strategy

```sql
-- Performance indexes
CREATE INDEX idx_users_trust_score ON users(trust_score);
CREATE INDEX idx_recycle_actions_user_created ON recycle_actions(user_id, created_at DESC);
CREATE INDEX idx_recycle_actions_point_created ON recycle_actions(recycling_point_id, created_at DESC);
CREATE INDEX idx_recycle_actions_status_created ON recycle_actions(status, created_at DESC);
CREATE INDEX idx_recycle_actions_image_hash ON recycle_actions(image_hash);
CREATE INDEX idx_recycle_actions_idempotency ON recycle_actions(idempotency_key);
CREATE INDEX idx_trust_history_user_created ON trust_history(user_id, created_at DESC);
CREATE INDEX idx_rewards_user_created ON rewards(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_type_created ON audit_logs(action_type, created_at DESC);

-- Unique constraints
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE UNIQUE INDEX idx_recycle_actions_image_hash_unique ON recycle_actions(image_hash);
CREATE UNIQUE INDEX idx_recycle_actions_idempotency_unique ON recycle_actions(idempotency_key);
CREATE UNIQUE INDEX idx_rewards_action_unique ON rewards(action_id);
```

---

## 🔐 SECURITY ARCHITECTURE

### Authentication Flow

```
1. User Registration/Login
   POST /api/v1/auth/register
   POST /api/v1/auth/login
   
2. JWT Token Generation
   ├── Access Token (15min expiry)
   │   └── Payload: { userId, email, role }
   └── Refresh Token (7days expiry)
       └── Stored in HTTP-only cookie

3. Token Refresh
   POST /api/v1/auth/refresh
   ├── Validate refresh token
   ├── Rotate refresh token (new token, invalidate old)
   └── Issue new access token

4. Request Authentication
   ├── Extract token from Authorization header
   ├── Verify signature & expiry
   ├── Load user from database
   └── Attach user to request context
```

### Authorization Levels

```
Roles:
├── USER (default)
│   ├── Submit recycle actions
│   ├── View own history
│   └── View own rewards
│
├── ADMIN
│   ├── All USER permissions
│   ├── Manage recycling points
│   ├── View all actions
│   ├── Moderate flagged actions
│   ├── View fraud patterns
│   └── Manage users
│
└── SUPER_ADMIN
    ├── All ADMIN permissions
    ├── System configuration
    └── Database management
```

---

## 🎯 VERIFICATION ARCHITECTURE

### Verification Pipeline

```
Input: RecycleActionSubmission
│
├─► [1] Image Validation
│   ├── Hash verification (SHA-256)
│   ├── Perceptual hash check (pHash)
│   ├── Image metadata validation
│   └── Format & size check
│
├─► [2] Object Detection Validation
│   ├── Confidence ≥ 0.80
│   ├── Bounding box area ≥ 0.25
│   ├── Frame count ≥ 4
│   ├── Motion score ≥ 0.3
│   ├── Frame sequence validation
│   └── Bounding box consistency
│
├─► [3] Location Validation
│   ├── GPS accuracy ≤ 20m
│   ├── Distance to point ≤ radius
│   ├── Speed check (≤ 5 m/s)
│   ├── Jump detection
│   ├── Altitude check (if available)
│   └── Material match
│
├─► [4] AI Verification (Ollama) ⭐ NEW ANTI-CHEAT LAYER
│   ├── Download image from Supabase Storage
│   ├── Send to Ollama LLaVA model
│   ├── Prompt: "Analyze this image. What object do you see? 
│   │          Is it a plastic bottle, aluminum can, glass bottle, 
│   │          paper, or cardboard? Rate your confidence 0-1. 
│   │          Does the image look authentic (not edited/fake)? 
│   │          Is the object clearly visible and in good quality?"
│   ├── Parse AI response:
│   │   ├── Detected object type
│   │   ├── AI confidence score
│   │   ├── Authenticity check (true/false)
│   │   └── Quality assessment
│   ├── Compare AI result with mobile claims:
│   │   ├── Object type match? (must match)
│   │   ├── Confidence alignment? (AI confidence ≥ 0.7)
│   │   └── Authenticity verified? (must be true)
│   └── Calculate AI verification score (0-1)
│
├─► [5] Trust Score Check
│   └── Load user trust_score
│
├─► [6] Score Calculation (UPDATED with AI)
│   ├── Component scores (0-1 each):
│   │   ├── Object confidence: 20% (reduced from 25%)
│   │   ├── Multi-frame consistency: 15% (reduced from 20%)
│   │   ├── Motion detected: 10% (reduced from 15%)
│   │   ├── Location validity: 15% (reduced from 20%)
│   │   ├── Image uniqueness: 10%
│   │   ├── AI verification: 20% ⭐ NEW
│   │   └── User trust score: 10% (reduced from 15%)
│   └── Weighted sum
│
└─► [7] Decision
    ├── score ≥ 0.85 → VERIFIED
    └── score < 0.85 → REJECTED
```

### AI Verification Details

**Ollama Setup:**
- Model: `llava` (LLaVA 7B or 13B)
- Local installation (no API costs)
- Vision-language model for image understanding

**Verification Logic:**
1. Download image from Supabase Storage
2. Convert to base64
3. Send to Ollama with structured prompt
4. Parse JSON response
5. Validate against mobile claims
6. Generate AI confidence score

**AI Response Format:**
```json
{
  "object_type": "plastic_bottle",
  "confidence": 0.92,
  "authentic": true,
  "quality": "good",
  "reasoning": "I can clearly see a plastic bottle in the image..."
}
```

**Scoring:**
- Object type match: +0.5 (if matches mobile claim)
- AI confidence ≥ 0.8: +0.3
- Authenticity verified: +0.2
- Total AI score: 0.0 - 1.0

---

## 💰 REWARD CALCULATION ARCHITECTURE

### Reward Pipeline

```
Input: Verified RecycleAction
│
├─► [1] Check Limits
│   ├── Daily global limit (100 points)
│   ├── Daily location limit (40 points)
│   ├── Material cooldown (3 same / 10min)
│   ├── Global cooldown (30s)
│   └── Location cooldown (2min)
│
├─► [2] Calculate Base Points
│   └── Material → Base points mapping
│
├─► [3] Calculate Multipliers
│   ├── Location multiplier (from recycling_point)
│   ├── Streak multiplier (1 + streak_days * 0.05)
│   └── Trust multiplier (based on trust_score)
│
├─► [4] Calculate Final Points
│   └── base × location × streak × trust
│
├─► [5] Apply Caps
│   └── Ensure limits not exceeded
│
├─► [6] Award Points
│   ├── Update user points balance
│   ├── Create reward record
│   └── Update daily totals
│
└─► [7] Update Streak
    └── If first action today → increment streak
```

---

## 🔄 BACKGROUND JOBS ARCHITECTURE

### Job Queue (BullMQ/Redis)

```
Jobs:
├── trust-score-decay (Daily, 2 AM UTC)
│   ├── Load all users
│   ├── Apply time-based decay to violations
│   └── Update trust scores
│
├── fraud-pattern-analysis (Hourly)
│   ├── Check for duplicate images across users
│   ├── Detect location clustering
│   ├── Flag rapid submissions
│   └── Update fraud flags
│
├── cleanup-audit-logs (Weekly, Sunday 3 AM UTC)
│   ├── Archive logs older than 90 days
│   └── Delete archived data older than 1 year
│
└── daily-metrics (Daily, 1 AM UTC)
    ├── Calculate daily active users
    ├── Calculate verification success rate
    └── Store metrics for analytics
```

---

## 📊 CACHING STRATEGY

### Redis Cache Keys

```
User Data:
├── user:{userId}:trust_score (TTL: 5min)
├── user:{userId}:streak (TTL: 5min)
└── user:{userId}:daily_points (TTL: 24h)

Recycling Points:
├── recycling_point:{pointId} (TTL: 1h)
└── recycling_points:all (TTL: 1h)

Rate Limiting:
├── rate_limit:auth:{userId} (TTL: 15min)
├── rate_limit:action:{userId} (TTL: 1min)
└── rate_limit:api:{userId} (TTL: 1min)

Idempotency:
└── idempotency:{key} (TTL: 24h)

Daily Totals:
├── daily_points:{userId}:{date} (TTL: 24h)
└── daily_points_location:{userId}:{pointId}:{date} (TTL: 24h)
```

---

## 🚨 ERROR HANDLING ARCHITECTURE

### Error Hierarchy

```
BaseError
├── ValidationError (400)
│   ├── InvalidInputError
│   └── MissingFieldError
│
├── AuthenticationError (401)
│   ├── InvalidTokenError
│   └── ExpiredTokenError
│
├── AuthorizationError (403)
│   └── InsufficientPermissionsError
│
├── NotFoundError (404)
│   ├── UserNotFoundError
│   └── RecyclingPointNotFoundError
│
├── ConflictError (409)
│   ├── DuplicateImageError
│   └── IdempotencyKeyUsedError
│
├── RateLimitError (429)
│
└── InternalServerError (500)
    ├── DatabaseError
    ├── StorageError
    └── VerificationError
```

### Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid confidence value",
    "details": {
      "field": "confidence",
      "value": 0.75,
      "constraint": "Must be >= 0.80"
    },
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_abc123"
  }
}
```

---

## 📈 MONITORING & OBSERVABILITY

### Metrics Endpoints

```
GET /metrics (Prometheus format)
├── http_requests_total{method, endpoint, status}
├── http_request_duration_seconds{method, endpoint}
├── verification_attempts_total{status}
├── verification_score_histogram
├── trust_score_distribution
├── rewards_awarded_total
└── active_users_gauge
```

### Health Checks

```
GET /health
├── Database connection
├── Redis connection
├── Supabase Storage connection
└── Response: { status: "healthy", checks: {...} }

GET /ready
└── Response: { ready: true }

GET /live
└── Response: { alive: true }
```

---

## 🔧 CONFIGURATION MANAGEMENT

### Environment Variables

```env
# Application
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Database
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=...
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=...
JWT_REFRESH_EXPIRES_IN=7d

# Supabase Storage
SUPABASE_S3_ENDPOINT=...
SUPABASE_S3_REGION=...
SUPABASE_S3_ACCESS_KEY_ID=...
SUPABASE_S3_SECRET_ACCESS_KEY=...
SUPABASE_S3_BUCKET=...

# Rate Limiting
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100

# File Upload
MAX_FILE_SIZE=5242880  # 5MB
ALLOWED_FILE_TYPES=image/jpeg,image/png

# Verification Thresholds
MIN_CONFIDENCE=0.80
MIN_BOUNDING_BOX_AREA=0.25
MIN_FRAME_COUNT=4
MIN_MOTION_SCORE=0.3
MIN_VERIFICATION_SCORE=0.85
MAX_GPS_ACCURACY=20.0
MAX_SPEED_MPS=5.0

# Trust Score
INITIAL_TRUST_SCORE=0.7
TRUST_INCREASE_AMOUNT=0.01
TRUST_DECREASE_DUPLICATE=0.1
TRUST_DECREASE_GPS_ANOMALY=0.15
TRUST_DECREASE_REJECTED=0.05
TRUST_DECREASE_SUSPICIOUS=0.2
TRUST_DECAY_DAYS=30

# Rewards
MAX_DAILY_POINTS=100
MAX_LOCATION_DAILY_POINTS=40
MAX_SAME_MATERIAL_PER_10MIN=3
ACTION_COOLDOWN_SECONDS=30
LOCATION_COOLDOWN_SECONDS=120
```

---

## 🚀 DEPLOYMENT ARCHITECTURE

### Recommended Setup

```
Production:
├── Application Server (Node.js/NestJS)
│   ├── PM2 or systemd
│   ├── Multiple instances (load balanced)
│   └── Health checks enabled
│
├── Database (Neon PostgreSQL)
│   ├── Connection pooling
│   ├── Automated backups
│   └── Read replicas (if needed)
│
├── Cache (Redis)
│   ├── Persistence enabled
│   └── Replication (if needed)
│
└── Storage (Supabase S3)
    ├── CDN enabled
    └── Versioning enabled
```

### Scaling Considerations

```
Horizontal Scaling:
├── Stateless application (JWT, no sessions)
├── Load balancer (round-robin or least-connections)
└── Database connection pooling

Vertical Scaling:
├── Increase database resources
├── Increase Redis memory
└── Increase application memory

Caching Strategy:
├── Aggressive caching for read-heavy endpoints
├── Cache invalidation on writes
└── TTL-based expiration
```

---

## 📝 API VERSIONING STRATEGY

```
URL-based versioning:
/api/v1/recycle-actions
/api/v1/users
/api/v1/recycling-points

Version headers (optional):
Accept: application/vnd.ecoproof.v1+json

Breaking changes → New version (v2)
Non-breaking changes → Same version (v1)
```

---

This architecture ensures:
- ✅ Scalability
- ✅ Maintainability
- ✅ Security
- ✅ Performance
- ✅ Reliability
- ✅ Observability
