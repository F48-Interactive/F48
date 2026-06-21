/**
 * OrganizerController — REST endpoints for organizer profiles and verification.
 * ORG-ID-001 to ORG-ID-003.
 */
import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { OrganizerService } from './organizer.service.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser, type RequestUser } from '../../common/decorators/current-user.decorator.js';
import { Public, Roles } from '../../common/decorators/index.js';
import { ForbiddenError } from '../../lib/errors.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import {
  CreateOrganizerSchema,
  UpdateOrganizerSchema,
  SubmitYoutubeSchema,
  VerificationDecisionSchema,
} from './dto/organizer.dto.js';
import { YouTubeLookupAdapter } from '../../providers/youtube/youtube.adapter.js';

@ApiTags('Organizers')
@Controller('organizers')
export class OrganizerController {
  constructor(
    private readonly organizerService: OrganizerService,
    private readonly youtubeLookup: YouTubeLookupAdapter,
  ) {}

  /**
   * Check that user is not suspended/banned for mutation operations.
   */
  private assertActive(user: RequestUser): void {
    if (user.status === 'suspended' || user.status === 'banned') {
      throw new ForbiddenError(
        ErrorCodes.ACCOUNT_SUSPENDED,
        'Your account is restricted. Contact support.',
      );
    }
  }

  @Post('profile')
  @ApiOperation({ summary: 'Create organizer profile' })
  @UsePipes(new ZodValidationPipe(CreateOrganizerSchema))
  async createProfile(
    @CurrentUser() user: RequestUser,
    @Body() body: { displayName?: string; description?: string },
  ) {
    this.assertActive(user);
    return this.organizerService.createProfile(user.id, body);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get own organizer profile' })
  async getOwnProfile(@CurrentUser() user: RequestUser) {
    return this.organizerService.getOwnProfile(user.id);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update organizer profile' })
  @UsePipes(new ZodValidationPipe(UpdateOrganizerSchema))
  async updateProfile(
    @CurrentUser() user: RequestUser,
    @Body() body: { displayName?: string; description?: string; avatarAssetId?: string },
  ) {
    this.assertActive(user);
    return this.organizerService.updateProfile(user.id, body);
  }

  @Post('youtube')
  @ApiOperation({ summary: 'Submit YouTube channel URL for server-side fetch' })
  @UsePipes(new ZodValidationPipe(SubmitYoutubeSchema))
  async submitYoutube(
    @CurrentUser() user: RequestUser,
    @Body() body: { channelUrl: string },
  ) {
    this.assertActive(user);
    return this.organizerService.submitYoutubeChannel(
      user.id,
      body.channelUrl,
      this.youtubeLookup,
    );
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'List verified organizers' })
  async listVerified(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.organizerService.listVerified(
      Math.max(1, parseInt(page ?? '1', 10) || 1),
      Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20)),
    );
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get organizer public profile' })
  async getPublicProfile(@Param('id') id: string) {
    return this.organizerService.getPublicProfile(id);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin verification endpoints (separate controller for /admin prefix)
// ─────────────────────────────────────────────────────────────────────────────

@ApiTags('Admin - Organizers')
@Controller('admin/organizers')
export class AdminOrganizerController {
  constructor(private readonly organizerService: OrganizerService) {}

  @Get('pending')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'List pending organizer verifications' })
  async listPending(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.organizerService.listPendingVerifications(
      Math.max(1, parseInt(page ?? '1', 10) || 1),
      Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20)),
    );
  }

  @Post(':id/verify')
  @Roles('admin', 'super_admin')
  @ApiOperation({ summary: 'Make verification decision for organizer' })
  @UsePipes(new ZodValidationPipe(VerificationDecisionSchema))
  async verificationDecision(
    @Param('id') organizerId: string,
    @CurrentUser() admin: RequestUser,
    @Body() body: { decision: string; reason: string; fundingEligibility?: string },
  ) {
    return this.organizerService.adminVerificationDecision(
      organizerId,
      body as any,
      admin,
    );
  }
}
