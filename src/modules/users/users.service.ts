import { Injectable } from '@nestjs/common';
import { UsersRepo } from '../../repositories/users.repo';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthenticatedUser } from '../../middlewares/auth.middleware';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepo: UsersRepo) {}

  async create(createUserDto: CreateUserDto, user: AuthenticatedUser) {
    const existingUser = await this.usersRepo.getUserById(user.id, false);

    if (existingUser) {
      return { user: existingUser };
    }

    const createdUser = await this.usersRepo.createUser(
      user.id,
      user.email,
      createUserDto.name,
    );

    return { user: createdUser };
  }
}
