import { IsEnum, IsNumber, IsString, IsArray, IsObject, Min, Max, ValidateNested, IsNotEmpty, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { MaterialType } from '../../entities/recycling-point.entity';

export class FrameMetadataDto {
  @ApiProperty({ description: 'Frame index (0-4)', example: 0 })
  @IsNumber()
  frameIndex: number;

  @ApiProperty({ description: 'Unix timestamp in milliseconds', example: 1234567890123 })
  @IsNumber()
  timestamp: number;

  @ApiProperty({ description: 'Detection confidence (0-1)', example: 0.85, minimum: 0, maximum: 1 })
  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;

  @ApiProperty({
    description: 'Bounding box coordinates',
    example: { x: 100, y: 150, width: 200, height: 250 },
  })
  @IsObject()
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export class ImageMetadataDto {
  @ApiProperty({ description: 'Image width in pixels', example: 1920, minimum: 640, maximum: 4096 })
  @IsNumber()
  @Min(640, { message: 'Image width must be at least 640px. Please use a higher resolution.' })
  @Max(4096, { message: 'Image width cannot exceed 4096px.' })
  width: number;

  @ApiProperty({ description: 'Image height in pixels', example: 1080, minimum: 480, maximum: 4096 })
  @IsNumber()
  @Min(480, { message: 'Image height must be at least 480px. Please use a higher resolution.' })
  @Max(4096, { message: 'Image height cannot exceed 4096px.' })
  height: number;

  @ApiProperty({ description: 'Image format', example: 'jpeg', enum: ['jpeg', 'png'] })
  @IsString()
  format: string;

  @ApiProperty({ description: 'Capture timestamp in Unix milliseconds', example: 1234567890123 })
  @IsNumber()
  capturedAt: number;
}

export class SubmitActionDto {
  @ApiProperty({ description: 'Recycling point UUID', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  recyclingPointId: string;

  @ApiProperty({
    description: 'Detected material type (must match Roboflow classes)',
    enum: MaterialType,
    example: MaterialType.PLASTIC,
  })
  @IsEnum(MaterialType)
  objectType: MaterialType;

  @ApiProperty({
    description: 'Object detection confidence (0.80-1.0)',
    example: 0.85,
    minimum: 0.80,
    maximum: 1,
  })
  @IsNumber()
  @Min(0.80, { message: 'Confidence too low ({value}). Ensure the object is clearly visible and well-lit.' })
  @Max(1)
  confidence: number;

  @ApiProperty({
    description: 'Bounding box area ratio (0.25-1.0)',
    example: 0.30,
    minimum: 0.25,
    maximum: 1,
  })
  @IsNumber()
  @Min(0.25, { message: 'Object too small in frame ({value}). Please move closer to fill at least 25% of the screen.' })
  @Max(1)
  boundingBoxAreaRatio: number;

  @ApiProperty({
    description: 'Number of frames where object was detected (4-5)',
    example: 4,
    minimum: 4,
    maximum: 5,
  })
  @IsNumber()
  @Min(4, { message: 'Object detected in too few frames ({value}/5). Hold the camera steady on the object.' })
  @Max(5)
  frameCountDetected: number;

  @ApiProperty({
    description: 'Motion score (0.3-1.0)',
    example: 0.35,
    minimum: 0.3,
    maximum: 1,
  })
  @IsNumber()
  @Min(0.3, { message: 'Motion score too low ({value}). Please move the camera slightly to prove it is a live video.' })
  @Max(1)
  motionScore: number;

  @ApiProperty({ description: 'SHA-256 hash of the image', example: 'a3b5c7d9e1f2...' })
  @IsString()
  imageHash: string;

  @ApiProperty({ description: 'Perceptual hash (pHash) for similarity detection', example: 'abc123def456...' })
  @IsString()
  perceptualHash: string;

  @ApiProperty({ description: 'Frame metadata array', type: [FrameMetadataDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FrameMetadataDto)
  frameMetadata: FrameMetadataDto[];

  @ApiProperty({ description: 'Image metadata', type: ImageMetadataDto })
  @IsObject()
  @ValidateNested()
  @Type(() => ImageMetadataDto)
  imageMetadata: ImageMetadataDto;

  @ApiProperty({ description: 'GPS latitude', example: 40.7128 })
  @IsNumber()
  gpsLat: number;

  @ApiProperty({ description: 'GPS longitude', example: -74.0060 })
  @IsNumber()
  gpsLng: number;

  @ApiProperty({ description: 'GPS accuracy in meters', example: 12.5, minimum: 0 })
  @IsNumber()
  @Min(0)
  gpsAccuracy: number;

  @ApiProperty({ description: 'GPS altitude in meters (optional)', example: 10.5, required: false, minimum: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  gpsAltitude?: number;

  @ApiProperty({ description: 'Capture timestamp in Unix milliseconds', example: 1234567890123 })
  @IsNumber()
  capturedAt: number;

  @ApiProperty({ description: 'Idempotency key for duplicate request prevention', example: 'unique-request-id-123' })
  @IsString()
  idempotencyKey: string;
}
