## 2026-01-16 - API Error Messages as UX
**Learning:** For API-only projects, "UX" translates to "Developer Experience" (DX). Descriptive validation error messages (e.g., "Latitude must be between -90 and 90") prevent frustration and save debugging time for mobile/frontend developers consuming the API.
**Action:** Always override default class-validator messages for domain-specific constraints (ranges, enums, required fields) to guide the consumer on *how* to fix the error.
