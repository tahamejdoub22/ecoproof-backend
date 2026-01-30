## 2026-01-30 - Structured Error Messages for Backend
**Learning:** Returning structured `field: message` errors from backend allows generic frontend logic to map errors to inputs instantly without custom parsing.
**Action:** Configure NestJS ValidationPipe with custom `exceptionFactory` and `HttpExceptionFilter` to standardize this pattern.
