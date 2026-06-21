import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MediaService } from './media.service.js';
import {
  CurrentUser,
  type RequestUser,
} from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { RegisterMediaAssetSchema } from './dto/media.dto.js';

@ApiTags('Media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get('upload-signature')
  @ApiOperation({ summary: 'Get Cloudinary signed upload credentials' })
  async getUploadSignature(@Query('purpose') purpose: string) {
    return this.mediaService.getUploadSignature(purpose);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register uploaded Cloudinary asset' })
  @UsePipes(new ZodValidationPipe(RegisterMediaAssetSchema))
  async registerAsset(
    @CurrentUser() user: RequestUser,
    @Body() body: { purpose: string; publicId: string },
  ) {
    return this.mediaService.registerAsset({
      uploaderId: user.id,
      purpose: body.purpose,
      publicId: body.publicId,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get media asset' })
  async getById(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.mediaService.getById(id, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete media asset' })
  async delete(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    await this.mediaService.delete(id, user);
    return { message: 'Asset deleted.' };
  }
}
