import { Module } from '@nestjs/common';
import { MatchService } from './match.service.js';
import { MatchController } from './match.controller.js';

@Module({
  controllers: [MatchController],
  providers: [MatchService],
  exports: [MatchService],
})
export class MatchModule {}
