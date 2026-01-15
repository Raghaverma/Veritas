import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  validateSync,
} from 'class-validator';
import * as dotenv from 'dotenv';
import * as process from 'process';

dotenv.config();

export enum NodeEnvironment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
  Staging = 'staging',
}

class EnvironmentVariables {
  @IsEnum(NodeEnvironment)
  @IsOptional()
  NODE_ENV: NodeEnvironment = NodeEnvironment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  @IsNotEmpty()
  DB_URL: string;

  @IsString()
  @IsNotEmpty()
  CACHE_HOST: string;

  @IsNumber()
  @IsOptional()
  CACHE_PORT: number = 6379;

  @IsString()
  @IsOptional()
  USE_TLS: string = 'false';

  @IsString()
  @IsOptional()
  IS_REDIS_CLUSTER: string = 'false';

  @IsString()
  @IsOptional()
  CACHE_PASSWORD?: string;

  @IsString()
  @IsNotEmpty()
  FIREBASE_CLIENT_EMAIL: string;

  @IsString()
  @IsNotEmpty()
  FIREBASE_PRIVATE_KEY: string;

  @IsString()
  @IsNotEmpty()
  FIREBASE_PROJECT_ID: string;

  @IsString()
  @IsOptional()
  SENTRY_DSN?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}

export default () => {
  const validatedConfig = validate(process.env);

  const config = {
    port: validatedConfig.PORT ? Number(validatedConfig.PORT) : 3000,
    dbUrl: validatedConfig.DB_URL,
    nodeEnv: validatedConfig.NODE_ENV,
    cacheHost: validatedConfig.CACHE_HOST,
    useTls: validatedConfig.USE_TLS,
    cachePassword: validatedConfig.CACHE_PASSWORD,
    firebaseClientEmail: validatedConfig.FIREBASE_CLIENT_EMAIL,
    firebasePrivateKey: validatedConfig.FIREBASE_PRIVATE_KEY,
    firebaseProjectId: validatedConfig.FIREBASE_PROJECT_ID,
    isRedisCluster: validatedConfig.IS_REDIS_CLUSTER,
    cachePort: validatedConfig.CACHE_PORT,
    sentryDsn: validatedConfig.SENTRY_DSN,
  };

  return config;
};
