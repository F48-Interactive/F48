import { Global, Module } from '@nestjs/common';
import { ConfigModule } from './config.module.js';
import { FirebaseService } from './firebase.service.js';
import { RedisService } from './redis.service.js';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [FirebaseService, RedisService],
  exports: [FirebaseService, RedisService],
})
export class RuntimeModule {}
