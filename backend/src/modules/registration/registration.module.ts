import { Module } from '@nestjs/common';
import { RegistrationService } from './registration.service.js';
import { RegistrationController } from './registration.controller.js';

@Module({
  controllers: [RegistrationController],
  providers: [RegistrationService],
  exports: [RegistrationService],
})
export class RegistrationModule {}
