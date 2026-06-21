/**
 * PlayerController — REST endpoints for player profiles and FF bindings.
 * PLAYER-001 to PLAYER-010.
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
import { PlayerService } from './player.service.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { CurrentUser, type RequestUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/index.js';
import { ForbiddenError, NotFoundError } from '../../lib/errors.js';
import { ErrorCodes } from '../../common/constants/error-codes.js';
import {
  CreatePlayerSchema,
  UpdatePlayerSchema,
  FfLookupSchema,
  FfBindSchema,
  PlayerSearchSchema,
} from './dto/player.dto.js';

@ApiTags('Players')
@Controller('players')
export class PlayerController {
  constructor(private readonly playerService: PlayerService) {}

  /**
   * RBAC-004/005: Block suspended/banned users from mutations.
   */
  private assertActive(user: RequestUser): void {
    if (user.status === 'suspended' || user.status === 'banned') {
      throw new ForbiddenError(
        ErrorCodes.FORBIDDEN,
        'Your account is restricted. Contact support.',
      );
    }
  }

  @Post('profile')
  @ApiOperation({ summary: 'Create player profile (auto-generates Platform ID)' })
  @UsePipes(new ZodValidationPipe(CreatePlayerSchema))
  async createProfile(
    @CurrentUser() user: RequestUser,
    @Body() body: { username: string },
  ) {
    this.assertActive(user);
    return this.playerService.createProfile(user.id, body);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get own player profile with active FF binding' })
  async getProfile(@CurrentUser() user: RequestUser) {
    return this.playerService.getProfile(user.id);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Update player username or display name' })
  @UsePipes(new ZodValidationPipe(UpdatePlayerSchema))
  async updateProfile(
    @CurrentUser() user: RequestUser,
    @Body() body: { username?: string; displayName?: string },
  ) {
    this.assertActive(user);
    return this.playerService.updateProfile(user.id, body);
  }

  @Post('ff-lookup')
  @ApiOperation({ summary: 'Lookup Free Fire UID via Games Kinbo (rate-limited)' })
  @UsePipes(new ZodValidationPipe(FfLookupSchema))
  async ffLookup(
    @CurrentUser() user: RequestUser,
    @Body() body: { ffUid: string },
  ) {
    this.assertActive(user);
    // Need player ID for rate limiting
    const player = await this.playerService.getProfile(user.id);
    return this.playerService.ffLookupByUid(player.id, body.ffUid);
  }

  @Post('ff-bind')
  @ApiOperation({ summary: 'Confirm Free Fire UID binding' })
  @UsePipes(new ZodValidationPipe(FfBindSchema))
  async ffBind(
    @CurrentUser() user: RequestUser,
    @Body() body: { ffUid: string; ffNickname: string },
  ) {
    this.assertActive(user);
    const player = await this.playerService.getProfile(user.id);
    return this.playerService.ffBind(player.id, user.id, body.ffUid, body.ffNickname);
  }

  // NOTE: No DELETE /players/ff-bind — per PLAYER-008, FF unbinding requires
  // admin/support review, reason, history retention, and no active tournament
  // participation check. This is handled in the Admin module (Phase 7).

  @Get('search')
  @ApiOperation({ summary: 'Search players by Platform ID or username' })
  async searchPlayers(
    @Query('query') query: string,
    @Query('type') type: string,
  ) {
    const parsed = PlayerSearchSchema.parse({ query, type });
    return this.playerService.searchPlayers(parsed.query, parsed.type);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get player public profile' })
  async getPublicProfile(@Param('id') id: string) {
    return this.playerService.getPublicProfile(id);
  }
}
