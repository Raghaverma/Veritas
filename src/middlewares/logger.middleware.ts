import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request } from 'express';
import { logger } from '../utils/logger';
// import { v7 as uuidv7 } from 'uuid';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: any, next: () => void) {
    const reqId = 'uuidv7()';

    // Parse the raw request to access Fastify-specific properties

    logger.log(`-------Begin Request ${reqId}-------`);
    logger.log('Headers', req.headers);
    logger.log('Body', req.body);

    // Fastify uses slightly different properties for path info
    logger.log('Path', req.url);
    logger.log('Method', req.method);

    // Params and query are accessed differently in Fastify
    logger.log('Params', req.params);
    logger.log('Query', req.query);

    logger.log(`-------End Request ${reqId}-------`);
    next();
  }
}
