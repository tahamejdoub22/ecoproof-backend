import { validate } from "class-validator";
import { RegisterDto, LoginDto } from "./auth.dto";

describe("AuthDto Validation", () => {
  describe("RegisterDto", () => {
    it("should fail with custom message if email is invalid", async () => {
      const dto = new RegisterDto();
      dto.email = "invalid-email";
      dto.password = "password123"; // valid

      const errors = await validate(dto);
      const emailError = errors.find((e) => e.property === "email");
      expect(emailError).toBeDefined();
      expect(emailError?.constraints?.isEmail).toBe(
        "Please provide a valid email address",
      );
    });

    it("should fail with custom message if password is too short", async () => {
      const dto = new RegisterDto();
      dto.email = "test@example.com"; // valid
      dto.password = "short";

      const errors = await validate(dto);
      const passwordError = errors.find((e) => e.property === "password");
      expect(passwordError).toBeDefined();
      expect(passwordError?.constraints?.minLength).toBe(
        "Password must be at least 8 characters long",
      );
    });

    it("should fail with custom message if password is not a string", async () => {
      const dto = new RegisterDto();
      dto.email = "test@example.com";
      // @ts-expect-error Testing invalid type
      dto.password = 12345678;

      const errors = await validate(dto);
      const passwordError = errors.find((e) => e.property === "password");
      expect(passwordError).toBeDefined();
      expect(passwordError?.constraints?.isString).toBe(
        "Password must be a string",
      );
    });
  });

  describe("LoginDto", () => {
    it("should fail with custom message if email is invalid", async () => {
      const dto = new LoginDto();
      dto.email = "invalid-email";
      dto.password = "password123";

      const errors = await validate(dto);
      const emailError = errors.find((e) => e.property === "email");
      expect(emailError).toBeDefined();
      expect(emailError?.constraints?.isEmail).toBe(
        "Please provide a valid email address",
      );
    });

    it("should fail with custom message if password is not provided (or not string)", async () => {
      const dto = new LoginDto();
      dto.email = "test@example.com";
      // @ts-expect-error Testing invalid type
      dto.password = 123; // Not a string

      const errors = await validate(dto);
      const passwordError = errors.find((e) => e.property === "password");
      expect(passwordError).toBeDefined();
      expect(passwordError?.constraints?.isString).toBe(
        "Please provide your password",
      );
    });
  });
});
