import { Global, Module } from '@nestjs/common';
import { EventBusService } from './event-bus.service.js';

/**
 * Realtime module — foundational from Phase 0.
 * EventBusService is global so any module can emit events.
 * Socket.IO gateway and EventPublisherService added later.
 */
@Global()
@Module({
  providers: [EventBusService],
  exports: [EventBusService],
})
export class RealtimeModule {}
