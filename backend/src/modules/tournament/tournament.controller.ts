/**
 * TournamentController — REST endpoints for tournament CRUD and config.
 * TOUR-001 to TOUR-004.
 */
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
import { TournamentService } from './tournament.service.js';
import { TournamentConfigService } from './tournament-config.service.js';
import { TournamentQueryService } from './tournament-query.service.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import {
  CurrentUser,
  type RequestUser,
} from '../../common/decorators/current-user.decorator.js';
import { Idempotent, Public, Roles } from '../../common/decorators/index.js';
import { AccessAuthorityService } from '../../domain/access-authority.service.js';
import {
  CreateTournamentSchema,
  UpdateTournamentSchema,
  TransitionTournamentSchema,
  ScoringConfigSchema,
  PrizeConfigSchema,
  TiebreakConfigSchema,
  TournamentListSchema,
} from './dto/tournament.dto.js';

@ApiTags('Tournaments')
@Controller('tournaments')
export class TournamentController {
  constructor(
    private readonly tournamentService: TournamentService,
    private readonly tournamentConfig: TournamentConfigService,
    private readonly tournamentQuery: TournamentQueryService,
    private readonly access: AccessAuthorityService,
  ) {}

  @Post()
  @Idempotent()
  @ApiOperation({ summary: 'Create tournament draft' })
  async create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(CreateTournamentSchema)) body: any,
  ) {
    this.access.assertActiveUser(user);
    return this.tournamentService.create(user, body);
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'List tournaments (public)' })
  async list(
    @Query('status') status?: string,
    @Query('mode') mode?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = TournamentListSchema.parse({ status, mode, page, limit });
    return this.tournamentQuery.list(parsed);
  }

  @Get('my')
  @ApiOperation({ summary: 'List my tournaments (organizer)' })
  async listMine(
    @CurrentUser() user: RequestUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.tournamentQuery.listByOrganizer(
      user.id,
      Math.max(1, parseInt(page ?? '1', 10) || 1),
      Math.min(100, Math.max(1, parseInt(limit ?? '20', 10) || 20)),
    );
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get tournament details' })
  async getById(@Param('id') id: string) {
    return this.tournamentQuery.getById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update tournament draft' })
  async update(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateTournamentSchema)) body: any,
  ) {
    this.access.assertActiveUser(user);
    return this.tournamentService.update(user, id, body);
  }

  @Post(':id/transition')
  @Idempotent()
  @ApiOperation({ summary: 'Transition tournament status' })
  async transition(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(TransitionTournamentSchema))
    body: { action: string; reason?: string },
  ) {
    this.access.assertActiveUser(user);
    return this.tournamentService.transition(
      user,
      id,
      body.action,
      body.reason,
    );
  }

  @Post(':id/scoring-config')
  @Idempotent()
  @ApiOperation({ summary: 'Set scoring config (creates new version)' })
  async setScoringConfig(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ScoringConfigSchema)) body: any,
  ) {
    this.access.assertActiveUser(user);
    return this.tournamentConfig.setScoringConfig(user, id, body);
  }

  @Post(':id/config/:configVersionId/prizes')
  @Idempotent()
  @ApiOperation({ summary: 'Set prize rules for config version' })
  async setPrizeConfig(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('configVersionId') configVersionId: string,
    @Body(new ZodValidationPipe(PrizeConfigSchema)) body: any,
  ) {
    this.access.assertActiveUser(user);
    return this.tournamentConfig.setPrizeConfig(
      user,
      id,
      configVersionId,
      body,
    );
  }

  @Post(':id/config/:configVersionId/tiebreaks')
  @Idempotent()
  @ApiOperation({ summary: 'Set tiebreak rules for config version' })
  async setTiebreakConfig(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Param('configVersionId') configVersionId: string,
    @Body(new ZodValidationPipe(TiebreakConfigSchema)) body: any,
  ) {
    this.access.assertActiveUser(user);
    return this.tournamentConfig.setTiebreakConfig(
      user,
      id,
      configVersionId,
      body,
    );
  }
}
