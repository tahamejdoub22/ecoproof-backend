## 2024-05-22 - API Route Inconsistencies
**Learning:** Several controllers (`auth`, `users`, `recycling-points`) manually include the `api/v1` prefix in their `@Controller` decorator, while `main.ts` also sets it globally. This results in double prefixes (e.g., `/api/v1/api/v1/auth`).
**Action:** When adding new controllers, rely on the global prefix. Future refactors should remove the manual prefix from existing controllers to standardize the API surface.
