import { validate } from "class-validator";
import { RegisterDto, LoginDto } from "./auth.dto";

describe("AuthDto", () => {
  describe("RegisterDto", () => {
    it("should validate with user-friendly messages", async () => {
      const dto = new RegisterDto();
      dto.email = "invalid-email";
      dto.password = "short";

      const errors = await validate(dto);

      const emailError = errors.find((e) => e.property === "email");
      const passwordError = errors.find((e) => e.property === "password");

      expect(emailError).toBeDefined();
      expect(passwordError).toBeDefined();

      // Check for user-friendly messages
      expect(emailError?.constraints?.isEmail).toBe(
        "Please enter a valid email address",
      );
      expect(passwordError?.constraints?.minLength).toBe(
        "Password must be at least 8 characters long",
      );
    });

    it("should validate valid dto", async () => {
      const dto = new RegisterDto();
      dto.email = "test@example.com";
      dto.password = "securePassword123";

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  describe("LoginDto", () => {
    it("should validate with user-friendly messages", async () => {
      const dto = new LoginDto();
      dto.email = "invalid";
      dto.password = ""; // IsString will fail if empty string? No, empty string is string. But IsNotEmpty should be there?
      // Wait, LoginDto uses @IsString. Empty string IS a string.
      // I should check if @IsNotEmpty is needed. Usually yes.

      const errors = await validate(dto);
      const emailError = errors.find((e) => e.property === "email");
      const passwordError = errors.find((e) => e.property === "password");

      expect(emailError?.constraints?.isEmail).toBe(
        "Please enter a valid email address",
      );
      expect(passwordError?.constraints?.isNotEmpty).toBe(
        "Password is required",
      );
    });
  });
});
