import { Module } from '@nestjs/common';
import { DisputeService } from './dispute.service.js';
import { DisputeController } from './dispute.controller.js';

@Module({
  controllers: [DisputeController],
  providers: [DisputeService],
  exports: [DisputeService],
})
export class DisputeModule {}
