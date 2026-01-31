## 2024-05-23 - Structured Validation Errors
**Learning:** Custom validation messages in backend APIs often break frontend field mapping if the message content is unstructured (e.g. relying on regex guessing). This causes poor UX where errors don't appear next to the relevant input field.
**Action:** Use a deterministic separator (e.g., `|`) to couple field names with messages in the backend exception factory, ensuring the frontend always receives structured error data regardless of the message content.
