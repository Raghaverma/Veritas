import { DrizzleService } from './drizzle.service';
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  providers: [DrizzleService],
  exports: [DrizzleService],
})
export class DrizzleModule {}
