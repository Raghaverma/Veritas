import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthenticatedUser } from '../../middlewares/auth.middleware';
import { Reflector } from '@nestjs/core';

export const IsGlobalAdmin = Reflector.createDecorator<boolean>();

@Injectable()
export class RoleAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // const isGlobalAdmin = this.reflector.get<boolean>(
    //   IsGlobalAdmin,
    //   context.getHandler(),
    // );

    const request = context.switchToHttp().getRequest<
      Request & {
        user: AuthenticatedUser;
        actionCode: string;
        accountId: string;
      }
    >();

    const user = request.user;

    if (!user?.id) {
      throw new ForbiddenException('User not authenticated');
    }

    // const hasAccess = await this.userRoleService.validateAccess(
    //     user.id,
    //     isGlobalAdmin ? 'GLOBAL_ADMIN' : user.accountId,
    //     user.actionCode,
    // );
    //
    // if (!hasAccess) {
    //     throw new ForbiddenException('Action access denied');
    // }

    return true;
  }
}
