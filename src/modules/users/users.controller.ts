import { Body, Controller, Post } from '@nestjs/common';
import { UsersService } from './users.service';
import {
  AuthenticatedUser,
  GetAuthenticatedUser,
} from '../../middlewares/auth.middleware';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  create(
    @Body() createUserDto: CreateUserDto,
    @GetAuthenticatedUser() user: AuthenticatedUser,
  ) {
    return this.usersService.create(createUserDto, user);
  }
}
