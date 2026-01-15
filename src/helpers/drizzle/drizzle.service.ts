import { Injectable, OnModuleInit } from '@nestjs/common';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../db/schema';
import * as postgres from 'postgres';
import { ConfigService } from '@nestjs/config';
import { NodeEnvironment } from '../../config';

@Injectable()
export class DrizzleService implements OnModuleInit {
  db: PostgresJsDatabase<typeof schema>;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const databaseUrl = this.configService.get<string>('dbUrl');
    if (!databaseUrl) {
      throw new Error('Database URL is not defined in the configuration.');
    }
    const client = postgres(databaseUrl, { ssl: 'require' });

    this.db = drizzle(client, {
      schema,
      logger: this.configService.get('nodeEnv') === NodeEnvironment.Development,
    });
  }
}
