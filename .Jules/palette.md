## 2024-05-22 - API Validation Messages are UX
**Learning:** Backend validation errors often get swallowed or returned as generic "Bad Request" arrays. Formatting them as "Field: Issue" helps frontend developers and users immediately identify the problem.
**Action:** Always check `ValidationPipe` configuration in NestJS apps to ensuring friendly messages are actually returned, not just calculated and discarded.
