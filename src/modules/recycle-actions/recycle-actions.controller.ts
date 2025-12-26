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
import { ApiTags, ApiOperation, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { RecycleActionsService } from './recycle-actions.service';
import { SubmitActionDto } from '../../common/dto/submit-action.dto';
import { PaginationDto, PaginatedResponse } from '../../common/dto/pagination.dto';
import { SubmitActionResponseDto } from '../../common/dto/submit-action-response.dto';
import { ApiStandardResponse, ApiErrorResponse } from '../../common/decorators/api-response.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../../entities/user.entity';

@ApiTags('Recycle Actions')
@ApiBearerAuth()
@Controller('api/v1/recycle-actions')
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
  @ApiErrorResponse(401, 'Unauthorized')
  async getMyActions(
    @Request() req: { user: User },
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponse<any>> {
    return this.actionsService.getUserActions(req.user.id, pagination);
  }
}
