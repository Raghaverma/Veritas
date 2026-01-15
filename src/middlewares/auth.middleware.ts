import {
  BadRequestException,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import * as firebase from 'firebase-admin';
import { FirebaseService } from '../integrations/firebase/firebase.service';
import { Request, Response } from 'express';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly auth: firebase.auth.Auth;

  constructor(private readonly fireBaseService: FirebaseService) {
    this.auth = this.fireBaseService.getFirebaseAuth();
  }

  private static accessDenied(url: string, res: Response, reason?: string) {
    res.status(401).json({
      statusCode: 401,
      timestamp: new Date().toISOString(),
      path: url,
      message: reason ?? 'access denied',
    });
  }

  async use(req: Request, res: Response, next: () => void) {
    const actionCode = req.headers['x-action-code'];
    const accountId = req.headers['x-account-id'];

    if (!accountId || !actionCode)
      throw new BadRequestException(
        'Missing required headers: x-account-id or x-action-code',
      );

    const token = req.headers.authorization;

    if (token != null && token !== '') {
      try {
        const decodedToken = await this.auth.verifyIdToken(
          token.replace('Bearer ', ''),
          true,
        );
        const uid = decodedToken.uid;
        const email = decodedToken.email;

        // Ensure user exists in Firebase; if not, it will create one.
        if (!email) {
          throw new Error('Email is undefined in the decoded token');
        }

        // Attach user information to the request
        req['user'] = {
          id: uid,
          email,
          actionCode,
          accountId,
          // custom claims
        };
        next();
      } catch (e: any) {
        console.log(e);
        AuthMiddleware.accessDenied(
          req.url,
          res,
          e.errorInfo?.code === 'auth/id-token-expired'
            ? 'Token expired'
            : e.message,
        );
      }
    } else {
      AuthMiddleware.accessDenied(req.url, res, 'Token not sent');
    }
  }
}

export type AuthenticatedUser = {
  id: string;
  email: string;
  accountId: string;
  actionCode: string;
};

export const GetAuthenticatedUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => {
    const request: Request & { user: AuthenticatedUser } = ctx
      .switchToHttp()
      .getRequest();
    return request.user;
  },
);
