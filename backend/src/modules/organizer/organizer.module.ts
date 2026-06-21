/**
 * OrganizerModule — Organizer profile management and verification.
 */
import { Module } from '@nestjs/common';
import { OrganizerService } from './organizer.service.js';
import {
  OrganizerController,
  AdminOrganizerController,
} from './organizer.controller.js';

@Module({
  controllers: [OrganizerController, AdminOrganizerController],
  providers: [OrganizerService],
  exports: [OrganizerService],
})
export class OrganizerModule {}
