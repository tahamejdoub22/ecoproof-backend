import { ApiProperty } from "@nestjs/swagger";

export class UserProfileDto {
  @ApiProperty({
    description: "User ID",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  id: string;

  @ApiProperty({ description: "User email", example: "user@example.com" })
  email: string;

  @ApiProperty({
    description: "User role",
    enum: ["USER", "ADMIN", "SUPER_ADMIN"],
    example: "USER",
  })
  role: string;

  @ApiProperty({
    description: "Trust score (0-1)",
    example: 0.75,
    minimum: 0,
    maximum: 1,
  })
  trustScore: number;

  @ApiProperty({ description: "Total points earned", example: 150 })
  totalPoints: number;

  @ApiProperty({ description: "Current streak in days", example: 5 })
  streakDays: number;

  @ApiProperty({
    description: "Account creation date",
    example: "2024-01-15T10:30:00Z",
  })
  createdAt: Date;
}
