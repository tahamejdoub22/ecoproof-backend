## 2024-05-23 - [API Error Messages]
**Learning:** Backend validation errors are the first line of defense for UX. Default `class-validator` messages like "email must be an email" are technical and unfriendly.
**Action:** Always provide custom `message` in decorators: `@IsEmail({}, { message: 'Please provide a valid email address.' })`. This allows the frontend to display the error directly without mapping.
