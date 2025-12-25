import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { RecycleActionsService } from './recycle-actions.service';
import { SubmitActionDto } from '../../common/dto/submit-action.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { User } from '../../entities/user.entity';

@Controller('api/v1/recycle-actions')
@UseGuards(JwtAuthGuard)
export class RecycleActionsController {
  constructor(private actionsService: RecycleActionsService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @UseInterceptors(FileInterceptor('image'))
  async submit(
    @Request() req: { user: User },
    @Body() dto: SubmitActionDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new Error('Image file is required');
    }

    const ipAddress = req.headers['x-forwarded-for'] as string;
    const userAgent = req.headers['user-agent'];

    return this.actionsService.submit(
      req.user.id,
      dto,
      file,
      ipAddress,
      userAgent,
    );
  }

  @Get('my-actions')
  async getMyActions(@Request() req: { user: User }) {
    return this.actionsService.getUserActions(req.user.id);
  }
}
