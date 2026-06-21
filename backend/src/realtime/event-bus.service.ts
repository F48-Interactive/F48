import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from 'eventemitter2';
import type { F48Event, F48EventType } from '../types/events.js';

/**
 * Typed Event Bus Service.
 * Internal pub/sub for domain events within the backend.
 * EventPublisherService subscribes and broadcasts to Socket.IO rooms.
 *
 * Established in Phase 0 — used by every module that emits events.
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);
  private readonly emitter = new EventEmitter2({
    wildcard: false,
    maxListeners: 50,
    verboseMemoryLeak: true,
  });

  /**
   * Emit a typed domain event.
   */
  emit(event: F48Event): void {
    this.logger.debug(
      { eventType: event.eventType, entityId: event.entityId },
      'Event emitted',
    );
    this.emitter.emit(event.eventType, event);
  }

  /**
   * Subscribe to a specific event type.
   */
  on(eventType: F48EventType, handler: (event: F48Event) => void): void {
    this.emitter.on(eventType, handler);
  }

  /**
   * Subscribe to all events (for logging, metrics, etc.).
   */
  onAny(handler: (eventType: string, event: F48Event) => void): void {
    this.emitter.onAny(handler);
  }

  /**
   * Remove a specific listener.
   */
  off(eventType: F48EventType, handler: (event: F48Event) => void): void {
    this.emitter.off(eventType, handler);
  }
}
