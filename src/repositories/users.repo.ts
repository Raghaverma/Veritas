/**
 * Users Repository
 *
 * Data access layer for user entities.
 * Handles database operations and caching for users.
 */

import { BadRequestException, Injectable } from '@nestjs/common';
import { DrizzleService } from '../helpers/drizzle/drizzle.service';
import { CacheService } from '../helpers/cache/cache.service';
import { desc, eq } from 'drizzle-orm';
import { users } from '../db/schema';
import { User, NewUser } from '../db/types';
import { CacheMapper } from '../helpers/cache/cache.mapper';

@Injectable()
export class UsersRepo {
  constructor(
    private readonly drizzleService: DrizzleService,
    private readonly cacheService: CacheService,
    private readonly cacheMapper: CacheMapper,
  ) {}

  async createUser(id: string, email: string, name?: string): Promise<User> {
    const [created] = await this.drizzleService.db
      .insert(users)
      .values({
        id,
        email,
        name: name ?? null,
        status: 'active',
      })
      .returning();

    return created;
  }

  async updateUser(
    id: string,
    data: Partial<Pick<User, 'name' | 'status'>>,
  ): Promise<User> {
    await this.cacheService.hDel(
      this.cacheMapper.hgetUserById(id).key,
      this.cacheMapper.hgetUserById(id).field,
    );

    const [updated] = await this.drizzleService.db
      .update(users)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    return updated;
  }

  async getAllUsers(offset: number = 0, limit: number = 20): Promise<User[]> {
    return this.drizzleService.db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt))
      .offset(offset)
      .limit(limit);
  }

  async getUserById(userId: string, throwErr = true): Promise<User | null> {
    return this.cacheService.hCache<User>((cacheMapper) => ({
      ...cacheMapper.hgetUserById(userId),
      func: async () => {
        const result = await this.drizzleService.db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (throwErr && (!result || result.length === 0)) {
          throw new BadRequestException('User not found');
        }

        return result[0] ?? null;
      },
    }));
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.drizzleService.db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);

    return result[0] ?? null;
  }

  async ensureUserExists(
    id: string,
    email: string,
    name?: string,
  ): Promise<User> {
    const existing = await this.getUserById(id, false);

    if (existing) {
      return existing;
    }

    return this.createUser(id, email, name);
  }
}
