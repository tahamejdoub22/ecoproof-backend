## 2024-05-22 - [Backend Validation UX]
**Learning:** `class-validator`'s `@IsString()` allows empty strings. This leads to API accepting empty passwords/tokens if `@IsNotEmpty()` is missing.
**Action:** Always use `@IsNotEmpty()` alongside `@IsString()` for required string fields to ensure robust validation and provide clear "Required" messages.
