import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { Request } from 'express';
import { logger } from '../../utils/logger';
import * as Sentry from '@sentry/nestjs';
import { NodeEnvironment } from '../../config';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    // In certain situations `httpAdapter` might not be available in the
    // constructor method, thus we should resolve it here.
    const { httpAdapter } = this.httpAdapterHost;

    const ctx = host.switchToHttp();
    const request: Request = ctx.getRequest();

    logger.error(
      `--------------Begin Error in path ${request.method}${request.url}--------------`,
    );
    // using console log because it logs trace
    console.log('Body', request.body);
    console.log('Params', request.params);
    console.log('Query', request.query);
    console.log('Headers', request.headers);
    console.log(exception);
    if (process.env.NODE_ENV !== NodeEnvironment.Development) {
      Sentry.captureException(exception);
    }

    logger.error(
      `-------------End Error in path ${request.url}-----------------`,
    );

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const responseBody = {
      message:
        exception instanceof HttpException
          ? exception.message
          : 'Internal Server Error',
    };

    httpAdapter.reply(ctx.getResponse(), responseBody, httpStatus);
  }
}
