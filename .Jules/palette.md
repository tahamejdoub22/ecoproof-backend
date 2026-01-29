## 2026-01-29 - Structured Validation Errors
**Learning:** Providing friendly, conversational validation messages (e.g., "Please enter your email") breaks client-side field association if the error handler relies on regex parsing (e.g., expecting "email ...").
**Action:** Decouple field names from error messages by returning structured error objects `{ field: 'email', message: 'Please enter...' }` from the backend to allow rich, accessible feedback without compromising technical field mapping.
