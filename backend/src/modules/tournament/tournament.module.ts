/**
 * TournamentModule — Tournament CRUD, state machine, config versioning.
 */
import { Module } from '@nestjs/common';
import { TournamentService } from './tournament.service.js';
import { TournamentController } from './tournament.controller.js';

@Module({
  controllers: [TournamentController],
  providers: [TournamentService],
  exports: [TournamentService],
})
export class TournamentModule {}
