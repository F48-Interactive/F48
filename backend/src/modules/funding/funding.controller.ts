/**
 * FundingController — Funding request endpoints.
 */
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { FundingService } from './funding.service.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  CurrentUser,
  type RequestUser,
} from '../../common/decorators/current-user.decorator.js';
import {
  ElevatedAction,
  Idempotent,
  Roles,
} from '../../common/decorators/index.js';
import {
  CreateFundingRequestSchema,
  ReviewFundingRequestSchema,
} from './dto/funding.dto.js';

@ApiTags('Funding')
@Controller('funding')
export class FundingController {
  constructor(private readonly fundingService: FundingService) {}

  @Post('request')
  @Idempotent()
  @ApiOperation({ summary: 'Create funding request' })
  async createRequest(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(CreateFundingRequestSchema))
    body: { tournamentId: string; requestedPaise: number },
  ) {
    return this.fundingService.createRequest(
      user,
      body.tournamentId,
      BigInt(body.requestedPaise),
    );
  }

  @Post(':id/submit')
  @Idempotent()
  @ApiOperation({ summary: 'Submit funding request for review' })
  async submitRequest(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.fundingService.submitRequest(user, id);
  }

  @Post(':id/review')
  @Idempotent()
  @ElevatedAction()
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Admin: review funding request' })
  async review(
    @CurrentUser() admin: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ReviewFundingRequestSchema))
    body: { decision: any; approvedPaise?: number; notes?: string },
  ) {
    return this.fundingService.adminReview(
      admin,
      id,
      body.decision,
      body.approvedPaise ? BigInt(body.approvedPaise) : undefined,
      body.notes,
    );
  }

  @Get('pending')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'List pending funding requests' })
  async listPending(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.fundingService.listPending(
      Math.max(1, parseInt(page ?? '1', 10) || 1),
      Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20)),
    );
  }
}
