/**
 * PlayerModule — Player profile and FF binding management.
 */
import { Module } from '@nestjs/common';
import { PlayerService } from './player.service.js';
import { PlayerController } from './player.controller.js';

@Module({
  controllers: [PlayerController],
  providers: [PlayerService],
  exports: [PlayerService],
})
export class PlayerModule {}
