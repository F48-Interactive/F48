import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service.js';
import { StatusHistoryService } from './status-history.service.js';

@Global()
@Module({
  providers: [AuditService, StatusHistoryService],
  exports: [AuditService, StatusHistoryService],
})
export class AuditModule {}
