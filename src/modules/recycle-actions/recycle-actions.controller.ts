import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth, ApiBody, ApiQuery } from '@nestjs/swagger';
import { RecycleActionsService } from './recycle-actions.service';
import { SubmitActionDto } from '../../common/dto/submit-action.dto';
import { PaginationDto, PaginatedResponse } from '../../common/dto/pagination.dto';
import { SubmitActionResponseDto } from '../../common/dto/submit-action-response.dto';
import { ApiStandardResponse, ApiErrorResponse } from '../../common/decorators/api-response.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../../entities/user.entity';

@ApiTags('Recycle Actions')
@ApiBearerAuth()
@Controller('recycle-actions')
@UseGuards(JwtAuthGuard)
export class RecycleActionsController {
  constructor(private actionsService: RecycleActionsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('image'))
  @ApiOperation({
    summary: 'Submit recycling action',
    description: 'Submit a recycling action with image and metadata. The action will be verified asynchronously.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'recyclingPointId',
        'objectType',
        'confidence',
        'boundingBoxAreaRatio',
        'frameCountDetected',
        'motionScore',
        'imageHash',
        'perceptualHash',
        'frameMetadata',
        'imageMetadata',
        'gpsLat',
        'gpsLng',
        'gpsAccuracy',
        'capturedAt',
        'idempotencyKey',
        'image',
      ],
      properties: {
        recyclingPointId: {
          type: 'string',
          description: 'Recycling point UUID',
          example: '550e8400-e29b-41d4-a716-446655440000',
        },
        objectType: {
          type: 'string',
          enum: ['cardboard', 'glass', 'metal', 'paper', 'plastic'],
          description: 'Detected material type',
          example: 'plastic',
        },
        confidence: {
          type: 'number',
          description: 'Detection confidence (0.80-1.0)',
          example: 0.85,
          minimum: 0.80,
          maximum: 1.0,
        },
        boundingBoxAreaRatio: {
          type: 'number',
          description: 'Bounding box area ratio (0.25-1.0)',
          example: 0.30,
          minimum: 0.25,
          maximum: 1.0,
        },
        frameCountDetected: {
          type: 'number',
          description: 'Number of frames detected (4-5)',
          example: 4,
          minimum: 4,
          maximum: 5,
        },
        motionScore: {
          type: 'number',
          description: 'Motion score (0.3-1.0)',
          example: 0.35,
          minimum: 0.3,
          maximum: 1.0,
        },
        imageHash: {
          type: 'string',
          description: 'SHA-256 hash of the image',
          example: 'a3b5c7d9e1f2g3h4i5j6k7l8m9n0o1p2q3r4s5t6u7v8w9x0y1z2',
        },
        perceptualHash: {
          type: 'string',
          description: 'Perceptual hash (pHash)',
          example: 'abc123def456ghi789jkl012mno345pqr678stu901vwx234',
        },
        frameMetadata: {
          type: 'array',
          description: 'Frame metadata array',
          items: {
            type: 'object',
            properties: {
              frameIndex: { type: 'number', example: 0 },
              timestamp: { type: 'number', example: 1234567890123 },
              confidence: { type: 'number', example: 0.85 },
              boundingBox: {
                type: 'object',
                properties: {
                  x: { type: 'number', example: 100 },
                  y: { type: 'number', example: 150 },
                  width: { type: 'number', example: 200 },
                  height: { type: 'number', example: 250 },
                },
              },
            },
          },
        },
        imageMetadata: {
          type: 'object',
          description: 'Image metadata',
          properties: {
            width: { type: 'number', example: 1920 },
            height: { type: 'number', example: 1080 },
            format: { type: 'string', example: 'jpeg' },
            capturedAt: { type: 'number', example: 1234567890123 },
          },
        },
        gpsLat: {
          type: 'number',
          description: 'GPS latitude',
          example: 40.7128,
        },
        gpsLng: {
          type: 'number',
          description: 'GPS longitude',
          example: -74.0060,
        },
        gpsAccuracy: {
          type: 'number',
          description: 'GPS accuracy in meters',
          example: 12.5,
          minimum: 0,
        },
        gpsAltitude: {
          type: 'number',
          description: 'GPS altitude in meters (optional)',
          example: 10.5,
        },
        capturedAt: {
          type: 'number',
          description: 'Capture timestamp in Unix milliseconds',
          example: 1234567890123,
        },
        idempotencyKey: {
          type: 'string',
          description: 'Idempotency key for duplicate prevention',
          example: 'unique-request-id-123',
        },
        image: {
          type: 'string',
          format: 'binary',
          description: 'Image file (JPEG or PNG)',
        },
      },
    },
  })
  @ApiStandardResponse(SubmitActionResponseDto, {
    status: 202,
    description: 'Recycling action submitted successfully. Processing asynchronously.',
    example: {
      verified: false,
      actionId: '550e8400-e29b-41d4-a716-446655440000',
      status: 'PENDING',
      reason: 'Processing...',
    },
  })
  @ApiErrorResponse(400, 'Validation failed')
  @ApiErrorResponse(401, 'Unauthorized')
  @ApiErrorResponse(429, 'Rate limit exceeded')
  async submit(
    @Request() req: { user: User; headers: any },
    @Body() dto: SubmitActionDto,
    @UploadedFile() file: any,
  ): Promise<SubmitActionResponseDto> {
    if (!file) {
      throw new BadRequestException('Image file is required');
    }

    const ipAddress = req.headers?.['x-forwarded-for'] as string;
    const userAgent = req.headers?.['user-agent'];

    return this.actionsService.submit(
      req.user.id,
      dto,
      file,
      ipAddress,
      userAgent,
    );
  }

  @Get('my-actions')
  @ApiOperation({
    summary: 'Get my recycling actions',
    description: 'Get paginated list of recycling actions for the authenticated user',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, description: 'Page number', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Items per page', example: 20 })
  @ApiStandardResponse(SubmitActionResponseDto, {
    status: 200,
    description: 'List of user recycling actions',
    isArray: true,
  })
  @ApiErrorResponse(401, 'Unauthorized')
  async getMyActions(
    @Request() req: { user: User },
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponse<any>> {
    return this.actionsService.getUserActions(req.user.id, pagination);
  }
}
