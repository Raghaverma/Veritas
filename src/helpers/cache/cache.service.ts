import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis, { Cluster, ClusterNode, ClusterOptions } from 'ioredis';
import { logger } from '../../utils/logger';
import { CacheMapper } from './cache.mapper';
import { HashTtlCache, TtlCache } from './cache.types';
import { CACHE_TTL } from '../../utils/constants';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CacheService implements OnModuleDestroy {
  client: Redis | Cluster;

  constructor(
    private readonly cacheMapper: CacheMapper,
    private readonly configService: ConfigService,
  ) {
    const env = this.configService.get<string>('nodeEnv');
    const host = this.configService.get<string>('cacheHost');
    const useTls = this.configService.get<string>('useTls');
    const cachePassword = this.configService.get<string>('cachePassword');
    const isCluster =
      this.configService.get<string>('isRedisCluster') === 'true';
    const cachePort = this.configService.get<number>('cachePort');

    if (isCluster) {
      // Cluster mode for production
      const nodes: ClusterNode[] = [
        {
          host,
          port: 6379,
        },
        // add more nodes if you have them, e.g. from env or config
      ];

      const options: ClusterOptions = {
        dnsLookup: (address, callback) => callback(null, address),
        redisOptions: {
          maxRetriesPerRequest: null,
          tls: useTls === 'true' ? {} : undefined,
        },
      };
      this.client = new Redis.Cluster(nodes, options);
    } else {
      // Single node client for non-prod / development
      this.client = new Redis({
        host,
        port: cachePort ?? 6379,
        maxRetriesPerRequest: null,
        password: cachePassword,
        tls: useTls === 'true' ? {} : undefined,
        username: 'default',
      });
    }

    const logMeta = {
      host: host,
      tlsCheck: useTls === 'true',
      isRedisCluster: isCluster,
      tlsVal: useTls,
      nodeEnv: env,
    };

    console.log('Connecting to Redis with:', logMeta);

    this.client.on('connect', () => console.log('✅ Cache cluster connected'));
    this.client.on('error', (err) => {
      console.log('Failed connecting to Redis with:', logMeta);
      console.error('❌ Redis error:', err);
    });
  }

  async get<T extends Record<string, any> | string | null>(
    key: string,
    parsed = false,
  ) {
    try {
      const data = await this.client.get(key);
      if (parsed && data) {
        return JSON.parse(data) as T;
      }
      return data as T;
    } catch (error: unknown) {
      logger.error('Error occurred while performing get from cache', {
        key,
        error,
      });
      return null;
    }
  }

  async set(key: string, value: string | Record<string, any>, ttl?: number) {
    try {
      if (typeof value === 'object') value = JSON.stringify(value);
      const data = await this.client.set(key, value);
      if (ttl) await this.client.expire(key, ttl);
      return data;
    } catch (error: unknown) {
      logger.error('Error occurred while performing set data', {
        key,
        error,
      });
      return null;
    }
  }

  async hGet<T extends Record<string, any> | null>(hKey: string, key: string) {
    try {
      if (typeof key === 'object') key = JSON.stringify(key);
      const data = await this.client.hget(hKey, key);
      if (data) {
        return JSON.parse(data) as T;
      }
      return null;
    } catch (error: unknown) {
      logger.error('Error occurred while performing set data', {
        error,
        hKey,
        key,
      });
      return null;
    }
  }

  async hGetAll(hKey: string) {
    try {
      const data = await this.client.hgetall(hKey);
      if (data) {
        return data;
      }
    } catch (error: unknown) {
      logger.error('Error occurred while preforming hGetAll data', {
        error,
        hKey,
      });
      return null;
    }
  }

  async hSet(key: string, data: Record<string, any>, ttl?: number) {
    try {
      await this.client.hset(key, data);
      ttl ??= CACHE_TTL.DAY; //1 day
      await this.client.expire(key, ttl);
    } catch (error: unknown) {
      logger.error('Error occurred while preforming hSet data', {
        key,
        data,
        ttl,
        error,
      });
    }
    return null;
  }

  async hDel(key: string, ...hKey: string[]) {
    try {
      await this.client.hdel(key, ...hKey);
      return;
    } catch (error: unknown) {
      logger.error('Error occurred while preforming hDel data', {
        hKey,
        error,
      });
      return null;
    }
  }

  async cache<T extends Record<string, any> | null>(
    getCacheConfig: (cacheMapper: CacheMapper) => TtlCache<T>,
  ): Promise<T | null> {
    try {
      const config = getCacheConfig(this.cacheMapper);
      let result: T | null = null;

      if (config.key) {
        const { func, key, ttl = CACHE_TTL.DAY } = config;
        result = await this.get<T>(key, true);
        if (result == undefined) {
          result = await func(key, ttl);
          if (result != undefined) {
            await this.set(key, result, ttl);
          }
        }
      }
      return result;
    } catch (error: unknown) {
      logger.error('Error occurred which executing cache layer check', {
        error,
      });
      throw error;
    }
  }

  async hCache<T extends Record<string, any> | null>(
    getCacheConfig: (cacheMapper: CacheMapper) => HashTtlCache<T>,
  ) {
    try {
      const config = getCacheConfig(this.cacheMapper);
      let result: T | null = null;

      if (config.key && config.field) {
        const { func, key, field, ttl = CACHE_TTL.DAY } = config;
        result = await this.hGet<T>(key, field);
        if (result == undefined) {
          result = await func(key, ttl);
          if (result != undefined) {
            await this.hSet(key, result, ttl);
          }
        }
      }
      return result;
    } catch (error: unknown) {
      logger.error('Error occurred while executing hash cache layer', {
        error,
      });
      throw error;
    }
  }

  async del(key: string) {
    try {
      const data = await this.client.del(key);
      if (data) logger.verbose(`deleted cache for key: ${key}`);
      return;
    } catch (error: unknown) {
      logger.error('Error occurred while preforming `del` data', {
        hKey: key,
        error,
      });
      return null;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }
}
