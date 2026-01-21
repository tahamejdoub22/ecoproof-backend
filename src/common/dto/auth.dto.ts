import {
  IsEmail,
  IsString,
  MinLength,
  IsOptional,
  IsNotEmpty,
} from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class RegisterDto {
  @ApiProperty({
    description: "User email address",
    example: "user@example.com",
  })
  @IsNotEmpty({ message: "Email is required." })
  @IsEmail({}, { message: "Please provide a valid email address." })
  email: string;

  @ApiProperty({
    description: "User password (minimum 8 characters)",
    example: "SecurePassword123!",
    minLength: 8,
  })
  @IsNotEmpty({ message: "Password is required." })
  @IsString({ message: "Password must be a string." })
  @MinLength(8, { message: "Password must be at least 8 characters long." })
  password: string;

  @ApiProperty({
    description: "Device fingerprint for security (optional)",
    example: "device-fingerprint-hash",
    required: false,
  })
  @IsString({ message: "Device fingerprint must be a string." })
  @IsOptional()
  deviceFingerprint?: string;
}

export class LoginDto {
  @ApiProperty({
    description: "User email address",
    example: "user@example.com",
  })
  @IsNotEmpty({ message: "Email is required." })
  @IsEmail({}, { message: "Please provide a valid email address." })
  email: string;

  @ApiProperty({
    description: "User password",
    example: "SecurePassword123!",
  })
  @IsNotEmpty({ message: "Password is required." })
  @IsString({ message: "Password must be a string." })
  password: string;

  @ApiProperty({
    description: "Device fingerprint for security (optional)",
    example: "device-fingerprint-hash",
    required: false,
  })
  @IsString({ message: "Device fingerprint must be a string." })
  @IsOptional()
  deviceFingerprint?: string;
}

export class RefreshTokenDto {
  @ApiProperty({
    description: "Refresh token",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  @IsNotEmpty({ message: "Refresh token is required." })
  @IsString({ message: "Refresh token must be a string." })
  refreshToken: string;
}
