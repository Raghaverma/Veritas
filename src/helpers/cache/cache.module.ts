import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheMapper } from './cache.mapper';

@Global()
@Module({
  providers: [CacheService, CacheMapper],
  exports: [CacheService, CacheMapper],
})
export class CacheModule {}
