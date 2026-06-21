import { Module } from '@nestjs/common';
import { ScoringService } from './scoring.service.js';
import { ScoringController } from './scoring.controller.js';

@Module({
  controllers: [ScoringController],
  providers: [ScoringService],
  exports: [ScoringService],
})
export class ScoringModule {}
