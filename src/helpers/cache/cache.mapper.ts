import { Injectable } from '@nestjs/common';
import { CACHE_TTL } from '../../utils/constants';

@Injectable()
export class CacheMapper {
  hgetUserById(userId: string) {
    return {
      field: 'user',
      key: `user_${userId}`,
      ttl: CACHE_TTL.DAY,
    };
  }
}
