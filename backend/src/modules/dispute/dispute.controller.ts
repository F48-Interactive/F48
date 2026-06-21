import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DisputeService } from './dispute.service.js';
import {
  CurrentUser,
  type RequestUser,
} from '../../common/decorators/current-user.decorator.js';
import { Idempotent, Roles } from '../../common/decorators/index.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  FileDisputeSchema,
  TransitionDisputeSchema,
  type FileDisputeInput,
  type TransitionDisputeInput,
} from './dto/dispute.dto.js';

@ApiTags('Disputes')
@Controller('disputes')
export class DisputeController {
  constructor(private readonly disputeService: DisputeService) {}

  @Post()
  @Idempotent()
  @ApiOperation({ summary: 'File a dispute' })
  async fileDispute(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(FileDisputeSchema)) body: FileDisputeInput,
  ) {
    return this.disputeService.fileDispute(
      user,
      body.matchResultId,
      body.category,
      body.description,
      body.evidenceAssetIds,
    );
  }

  @Patch(':id/transition')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Admin: transition dispute status' })
  async transition(
    @CurrentUser() admin: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(TransitionDisputeSchema))
    body: TransitionDisputeInput,
  ) {
    return this.disputeService.transitionDispute(
      admin,
      id,
      body.status,
      body.resolution,
    );
  }

  @Post(':id/withdraw')
  @Idempotent()
  @ApiOperation({ summary: 'Withdraw dispute' })
  async withdraw(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.disputeService.withdraw(user, id);
  }

  @Get()
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'List disputes' })
  async list(
    @Query('status') status?: string,
    @Query('tournamentId') tournamentId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.disputeService.list({
      status,
      tournamentId,
      page: Math.max(1, parseInt(page ?? '1', 10) || 1),
      limit: Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20)),
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get dispute by ID' })
  async getById(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.disputeService.getById(user, id);
  }
}
