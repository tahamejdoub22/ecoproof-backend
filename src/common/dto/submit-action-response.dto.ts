import { ApiProperty } from "@nestjs/swagger";

export class SubmitActionResponseDto {
  @ApiProperty({
    description: "Whether the action was verified",
    example: true,
  })
  verified: boolean;

  @ApiProperty({
    description: "Points awarded (if verified)",
    example: 15,
    required: false,
  })
  points?: number;

  @ApiProperty({
    description: "Reason for rejection (if not verified)",
    example: "Verification score too low",
    required: false,
  })
  reason?: string;

  @ApiProperty({
    description: "Action ID for tracking",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  actionId: string;

  @ApiProperty({
    description: "Current status of the action",
    enum: ["PENDING", "VERIFIED", "REJECTED", "FLAGGED"],
    example: "VERIFIED",
  })
  status: string;

  @ApiProperty({
    description: "Verification score (0-1)",
    example: 0.85,
    required: false,
  })
  verificationScore?: number;
}
