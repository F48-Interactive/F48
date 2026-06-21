import { Controller, Get, Post, Patch, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { BannerService } from './banner.service.js';
import { Public, Roles } from '../../common/decorators/index.js';
import { CurrentUser, type RequestUser } from '../../common/decorators/current-user.decorator.js';

@ApiTags('Banners')
@Controller('banners')
export class BannerController {
  constructor(private readonly bannerService: BannerService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get active banners' })
  async getActive() {
    return this.bannerService.getActive();
  }

  @Post()
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Create banner' })
  async create(@Body() body: any) {
    return this.bannerService.create(body);
  }

  @Patch(':id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Update banner' })
  async update(@Param('id') id: string, @Body() body: any) {
    return this.bannerService.update(id, body);
  }

  @Delete(':id')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Delete banner' })
  async delete(@Param('id') id: string) {
    return this.bannerService.delete(id);
  }
}
