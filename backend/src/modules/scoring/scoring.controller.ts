import { Controller, Post, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ScoringService } from './scoring.service.js';
import { Public, Roles } from '../../common/decorators/index.js';
import { CurrentUser, type RequestUser } from '../../common/decorators/current-user.decorator.js';

@ApiTags('Scoring')
@Controller('scoring')
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) {}

  @Post('matches/:matchId/calculate')
  @Roles('organizer', 'admin', 'super_admin')
  @ApiOperation({ summary: 'Calculate points for match results' })
  async calculateMatchPoints(@Param('matchId') matchId: string) {
    return this.scoringService.calculateMatchPoints(matchId);
  }

  @Get('tournaments/:tournamentId/leaderboard')
  @Public()
  @ApiOperation({ summary: 'Get tournament leaderboard' })
  async getLeaderboard(@Param('tournamentId') tournamentId: string) {
    return this.scoringService.getLeaderboard(tournamentId);
  }

  @Get('registrations/:registrationId/scores')
  @Public()
  @ApiOperation({ summary: 'Get scoring breakdown for a registration' })
  async getRegistrationScores(@Param('registrationId') registrationId: string) {
    return this.scoringService.getRegistrationScores(registrationId);
  }
}
