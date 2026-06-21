import { Module } from '@nestjs/common';
import { FundingService } from './funding.service.js';
import { FundingController } from './funding.controller.js';

@Module({
  controllers: [FundingController],
  providers: [FundingService],
  exports: [FundingService],
})
export class FundingModule {}
