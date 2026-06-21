import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

/**
 * Auth Module — provides Google login, session cookie management, and user lookup.
 * Depends on global modules: DatabaseModule (PrismaService), AuditModule (AuditService),
 * ConfigModule (EnvService), and AppModule (FirebaseService).
 */
@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
