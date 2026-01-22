## 2024-05-22 - API Validation Messages
**Learning:** Backend validation messages are a key part of the "invisible UX". Default `class-validator` messages (e.g., "email must be an email") are robotic and unhelpful. Custom messages provide clarity and guide the user (or frontend dev) on how to fix the issue.
**Action:** Always add `message` property to `class-validator` decorators for user-facing inputs. Use "Please [action]" format for friendly guidance.
