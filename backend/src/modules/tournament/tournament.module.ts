/**
 * TournamentModule — Tournament CRUD, state machine, config versioning.
 */
import { Module } from '@nestjs/common';
import { TournamentService } from './tournament.service.js';
import { TournamentConfigService } from './tournament-config.service.js';
import { TournamentController } from './tournament.controller.js';
import { TournamentQueryService } from './tournament-query.service.js';

@Module({
  controllers: [TournamentController],
  providers: [
    TournamentService,
    TournamentConfigService,
    TournamentQueryService,
  ],
  exports: [TournamentService, TournamentConfigService, TournamentQueryService],
})
export class TournamentModule {}
