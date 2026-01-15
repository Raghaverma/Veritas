import { BadRequestException, Injectable } from '@nestjs/common';
import { DrizzleService } from '../helpers/drizzle/drizzle.service';
import { CacheService } from '../helpers/cache/cache.service';
import { desc, eq } from 'drizzle-orm';
import { users } from '../db/schema';
import { User } from '../db/types';
import { CacheMapper } from '../helpers/cache/cache.mapper';
import { CreateUserDto } from '../modules/users/dto/create-user.dto';
import { UpdateUserDto } from '../modules/users/dto/update-user.dto';

@Injectable()
export class UsersRepo {
  constructor(
    private readonly drizzleService: DrizzleService,
    private readonly cacheService: CacheService,
    private readonly cacheMapper: CacheMapper,
  ) {}

  async createUser(_id: string, user: CreateUserDto) {
    return (
      await this.drizzleService.db
        .insert(users)
        .values([
          {
            _id,
            ...user,
          },
        ])
        .returning()
    )[0];
  }

  async updateUser(_id: string, updateUserDto: UpdateUserDto) {
    await this.cacheService.hDel(
      this.cacheMapper.hgetUserById(_id).key,
      this.cacheMapper.hgetUserById(_id).field,
    );

    return (
      await this.drizzleService.db
        .update(users)
        .set(updateUserDto)
        .where(eq(users._id, _id))
        .returning()
    )[0];
  }

  async getAllUsers(offset: number = 0, limit: number = 20) {
    return this.drizzleService.db
      .select()
      .from(users)
      .orderBy(desc(users.createdAt))
      .offset(offset)
      .limit(limit);
  }

  async getUserById(userId: string, throwErr = true) {
    return this.cacheService.hCache<User>((cacheMapper) => ({
      ...cacheMapper.hgetUserById(userId),
      func: async () => {
        const user = await this.drizzleService.db
          .select()
          .from(users) // Assuming 'users' is the table name
          .where(eq(users._id, userId))
          .limit(1);

        if (throwErr && (!user || user.length === 0)) {
          throw new BadRequestException('User not found');
        }

        return user[0];
      },
    }));
  }
}
