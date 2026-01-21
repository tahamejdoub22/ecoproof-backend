import { validate } from "class-validator";
import { RegisterDto, LoginDto } from "./auth.dto";

describe("AuthDto Validation", () => {
  describe("RegisterDto", () => {
    it("should fail with friendly message when email is invalid", async () => {
      const dto = new RegisterDto();
      dto.email = "not-an-email";
      dto.password = "validpassword123";

      const errors = await validate(dto);
      const emailError = errors.find((e) => e.property === "email");

      expect(emailError).toBeDefined();
      expect(emailError.constraints.isEmail).toBe(
        "Please provide a valid email address.",
      );
    });

    it("should fail with friendly message when password is too short", async () => {
      const dto = new RegisterDto();
      dto.email = "test@example.com";
      dto.password = "short";

      const errors = await validate(dto);
      const passwordError = errors.find((e) => e.property === "password");

      expect(passwordError).toBeDefined();
      expect(passwordError.constraints.minLength).toBe(
        "Password must be at least 8 characters long.",
      );
    });

    it("should fail with friendly message when password is missing (undefined)", async () => {
      const dto = new RegisterDto();
      dto.email = "test@example.com";
      // dto.password is undefined

      const errors = await validate(dto);
      const passwordError = errors.find((e) => e.property === "password");

      expect(passwordError).toBeDefined();
      // Check for isNotEmpty
      expect(passwordError.constraints.isNotEmpty).toBe(
        "Password is required.",
      );
    });
  });

  describe("LoginDto", () => {
    it("should fail with friendly message when email is invalid", async () => {
      const dto = new LoginDto();
      dto.email = "bad-email";
      dto.password = "pass";
      const errors = await validate(dto);
      const emailError = errors.find((e) => e.property === "email");
      expect(emailError).toBeDefined();
      expect(emailError.constraints.isEmail).toBe(
        "Please provide a valid email address.",
      );
    });

    it("should fail with friendly message when password is missing", async () => {
      const dto = new LoginDto();
      dto.email = "test@example.com";
      // missing password
      const errors = await validate(dto);
      const passwordError = errors.find((e) => e.property === "password");
      expect(passwordError).toBeDefined();
      expect(passwordError.constraints.isNotEmpty).toBe(
        "Password is required.",
      );
    });
  });
});
