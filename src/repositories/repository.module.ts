import { Global, Module } from '@nestjs/common';
import { UsersRepo } from './users.repo';

@Global()
@Module({
  providers: [UsersRepo],
  exports: [UsersRepo],
})
export class RepositoryModule {}
