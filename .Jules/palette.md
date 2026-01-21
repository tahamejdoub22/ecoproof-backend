## 2026-01-21 - Humanizing API Validation
**Learning:** Default `class-validator` messages are robotic (e.g., "email must be an email"). Explicitly defining `message` in decorators allows for "conversation-like" feedback (e.g., "Please provide a valid email address").
**Action:** Always provide custom `message` in validation decorators for user-facing fields.
