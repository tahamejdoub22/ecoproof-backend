import { IsEnum, IsNumber, IsString, IsArray, IsObject, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { MaterialType } from '../../entities/recycling-point.entity';

export class FrameMetadataDto {
  @IsNumber()
  frameIndex: number;

  @IsNumber()
  timestamp: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;

  @IsObject()
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export class ImageMetadataDto {
  @IsNumber()
  @Min(640)
  @Max(4096)
  width: number;

  @IsNumber()
  @Min(480)
  @Max(4096)
  height: number;

  @IsString()
  format: string;

  @IsNumber()
  capturedAt: number;
}

export class SubmitActionDto {
  @IsString()
  recyclingPointId: string;

  @IsEnum(MaterialType)
  objectType: MaterialType;

  @IsNumber()
  @Min(0)
  @Max(1)
  confidence: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  boundingBoxAreaRatio: number;

  @IsNumber()
  @Min(1)
  @Max(5)
  frameCountDetected: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  motionScore: number;

  @IsString()
  imageHash: string;

  @IsString()
  perceptualHash: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FrameMetadataDto)
  frameMetadata: FrameMetadataDto[];

  @IsObject()
  @ValidateNested()
  @Type(() => ImageMetadataDto)
  imageMetadata: ImageMetadataDto;

  @IsNumber()
  gpsLat: number;

  @IsNumber()
  gpsLng: number;

  @IsNumber()
  @Min(0)
  gpsAccuracy: number;

  @IsNumber()
  @Min(0)
  gpsAltitude?: number;

  @IsNumber()
  capturedAt: number;

  @IsString()
  idempotencyKey: string;
}
