import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { RegisterDto, LoginDto, RefreshTokenDto } from "./auth.dto";

describe("Auth DTOs", () => {
  describe("RegisterDto", () => {
    it("should validate valid dto", async () => {
      const dto = plainToInstance(RegisterDto, {
        email: "test@example.com",
        password: "password123",
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it("should fail with invalid email", async () => {
      const dto = plainToInstance(RegisterDto, {
        email: "invalid-email",
        password: "password123",
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe("email");
      expect(errors[0].constraints).toHaveProperty(
        "isEmail",
        "Please provide a valid email address.",
      );
    });

    it("should fail with short password", async () => {
      const dto = plainToInstance(RegisterDto, {
        email: "test@example.com",
        password: "short",
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe("password");
      expect(errors[0].constraints).toHaveProperty(
        "minLength",
        "Password must be at least 8 characters long.",
      );
    });
  });

  describe("LoginDto", () => {
    it("should NOT allow empty password", async () => {
      const dto = plainToInstance(LoginDto, {
        email: "test@example.com",
        password: "",
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe("password");
      expect(errors[0].constraints).toHaveProperty(
        "isNotEmpty",
        "Password is required.",
      );
    });
  });

  describe("RefreshTokenDto", () => {
    it("should NOT allow empty refresh token", async () => {
      const dto = plainToInstance(RefreshTokenDto, {
        refreshToken: "",
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe("refreshToken");
      expect(errors[0].constraints).toHaveProperty(
        "isNotEmpty",
        "Refresh token is required.",
      );
    });
  });
});
