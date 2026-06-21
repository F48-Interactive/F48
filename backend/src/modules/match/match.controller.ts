import { Controller, Post, Get, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { MatchService } from './match.service.js';
import { CurrentUser, type RequestUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/index.js';

@ApiTags('Matches')
@Controller('matches')
export class MatchController {
  constructor(private readonly matchService: MatchService) {}

  @Post(':id/room-credentials')
  @ApiOperation({ summary: 'Set room credentials (organizer)' })
  async setRoomCredentials(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { roomId: string; roomPass: string; customCode?: string },
  ) {
    return this.matchService.setRoomCredentials(user, id, body.roomId, body.roomPass, body.customCode);
  }

  @Get(':id/room-credentials')
  @ApiOperation({ summary: 'Get room credentials (checked-in players only)' })
  async getRoomCredentials(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
  ) {
    return this.matchService.getRoomCredentials(user, id);
  }

  @Post(':id/transition')
  @ApiOperation({ summary: 'Transition match status' })
  async transitionMatch(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.matchService.transitionMatch(user, id, body.status);
  }

  @Post(':id/result')
  @ApiOperation({ summary: 'Submit match result' })
  async submitResult(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body() body: {
      playerResults: Array<{
        registrationId: string; placement: number; kills: number; isBooyah?: boolean;
      }>;
      evidenceAssetId?: string;
    },
  ) {
    return this.matchService.submitResult(user, id, body.playerResults, body.evidenceAssetId);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get match details with results' })
  async getMatch(@Param('id') id: string) {
    return this.matchService.getMatch(id);
  }

  @Get('tournament/:tournamentId')
  @Public()
  @ApiOperation({ summary: 'List matches for tournament' })
  async listByTournament(@Param('tournamentId') tournamentId: string) {
    return this.matchService.listByTournament(tournamentId);
  }
}
