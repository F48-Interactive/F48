import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MediaService } from './media.service.js';
import {
  CurrentUser,
  type RequestUser,
} from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  RegisterMediaAssetSchema,
  type RegisterMediaAssetInput,
} from './dto/media.dto.js';

@ApiTags('Media')
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register externally hosted media URL' })
  @UsePipes(new ZodValidationPipe(RegisterMediaAssetSchema))
  async registerAsset(
    @CurrentUser() user: RequestUser,
    @Body() body: RegisterMediaAssetInput,
  ) {
    return this.mediaService.registerAsset({
      uploaderId: user.id,
      ...body,
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
