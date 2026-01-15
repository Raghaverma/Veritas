import { BadRequestException, Injectable } from '@nestjs/common';
import * as firebase from 'firebase-admin';
import { auth } from 'firebase-admin';
import UserRecord = auth.UserRecord;
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FirebaseService {
  private readonly firebaseApp: firebase.app.App;

  constructor(private readonly configService: ConfigService) {
    const firebaseCred = firebase.credential.cert({
      clientEmail: this.configService.get<string>('firebaseClientEmail'),
      privateKey: this.configService.get<string>('firebasePrivateKey'),
      projectId: this.configService.get<string>('firebaseProjectId'),
    });

    if (firebase.apps.length === 0) {
      this.firebaseApp = firebase.initializeApp({
        credential: firebaseCred,
      });
    } else {
      this.firebaseApp = firebase.apps[0];
    }
  }

  getFirebaseAuth(): firebase.auth.Auth {
    return this.firebaseApp.auth();
  }

  getFirebaseMessaging(): firebase.messaging.Messaging {
    return this.firebaseApp.messaging();
  }

  async getFirebaseCustomToken({
    email,
    uid,
  }: {
    email: string;
    uid: string;
  }): Promise<{
    token: string;
    uid: string;
    success: boolean;
    message: string;
  }> {
    try {
      // Try to get the user by uid and email
      let user: UserRecord | null = await this.getFirebaseAuth()
        .getUser(uid)
        .catch(() => null);

      // If not found, try by email
      user ??= await this.getFirebaseAuth()
        .getUserByEmail(email)
        .catch(() => null);

      // If still not found, create a new user record
      if (!user) {
        user = await this.getFirebaseAuth().createUser({
          uid,
          email,
          emailVerified: true, // this can be changed as per use case
        });
      } else if (
        user.providerData.some((provider) => provider.providerId !== 'custom')
      ) {
        // If user exists but is authenticated using another provider,
        // throw an error
        throw new BadRequestException(
          'You are logged in with another method, please try authenticating with that',
        );
      }

      // Create a custom token for the (newly created or existing) user
      const token = await this.getFirebaseAuth().createCustomToken(user.uid, {
        email,
      });

      return {
        token,
        uid: user.uid,
        success: true,
        message: 'Success',
      };
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      throw new BadRequestException(`Firebase authentication error: ${error}`);
    }
  }
}
