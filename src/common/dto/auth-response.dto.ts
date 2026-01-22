import { ApiProperty } from "@nestjs/swagger";

export class AuthResponseDto {
  @ApiProperty({
    description: "JWT access token",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  accessToken: string;

  @ApiProperty({
    description: "JWT refresh token",
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  })
  refreshToken: string;

  @ApiProperty({
    description: "User information",
    example: { id: "...", email: "user@example.com" },
  })
  user: {
    id: string;
    email: string;
    role: string;
    trustScore: number;
  };
}

export class RegisterResponseDto extends AuthResponseDto {
  @ApiProperty({
    description: "Registration success message",
    example: "User registered successfully",
  })
  message: string;
}
