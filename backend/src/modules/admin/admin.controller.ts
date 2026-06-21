import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AdminService } from './admin.service.js';
import { CurrentUser, type RequestUser } from '../../common/decorators/current-user.decorator.js';
import { Roles, ElevatedAction } from '../../common/decorators/index.js';

@ApiTags('Admin')
@Controller('admin')
@Roles('admin', 'super_admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Admin dashboard stats' })
  async getDashboard() {
    return this.adminService.getDashboardStats();
  }

  @Post('users/:userId/moderate')
  @ElevatedAction()
  @ApiOperation({ summary: 'Suspend/ban/reinstate a user' })
  async moderateUser(
    @CurrentUser() admin: RequestUser,
    @Param('userId') userId: string,
    @Body() body: { action: 'suspend' | 'ban' | 'reinstate'; reason: string },
  ) {
    return this.adminService.moderateUser(admin, userId, body.action, body.reason);
  }

  @Post('players/:playerId/ff-unbind')
  @ElevatedAction()
  @ApiOperation({ summary: 'Admin: remove FF binding' })
  async ffUnbind(
    @CurrentUser() admin: RequestUser,
    @Param('playerId') playerId: string,
    @Body() body: { reason: string },
  ) {
    return this.adminService.ffUnbind(admin, playerId, body.reason);
  }

  @Get('actions')
  @ApiOperation({ summary: 'List admin actions' })
  async listActions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listActions(
      Math.max(1, parseInt(page ?? '1', 10) || 1),
      Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20)),
    );
  }
}
