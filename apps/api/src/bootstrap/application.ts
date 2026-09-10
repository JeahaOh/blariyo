import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter, type NestExpressApplication } from '@nestjs/platform-express';
import express, { type NextFunction, type Response } from 'express';
import { AppModule, type ApplicationOptions } from '../app.module.js';
import { CoreExceptionFilter, EnvelopeInterceptor } from '../http/response.js';
import type { CoreRequest } from '../http/contracts.js';
import { ApiError } from '../shared/errors.js';

/** All routes belong to Nest controllers. Express is used only to configure transport parsing. */
export async function createNestApplication(
  options: ApplicationOptions
): Promise<NestExpressApplication> {
  const transport = express();
  transport.disable('x-powered-by');
  transport.disable('etag');
  transport.use((request: CoreRequest, response: Response, next: NextFunction) => {
    request.requestId = randomUUID();
    request.maintenance = options.maintenance ?? false;
    response.set({ 'X-Request-Id': request.requestId, 'Cache-Control': 'no-store' });
    next();
  });
  const verify = (request: CoreRequest, _response: Response, bytes: Buffer) => {
    request.hasBody = bytes.length > 0;
  };
  transport.use(
    '/api/v1/boards/:boardSlug/posts/:postId/views',
    express.raw({ type: '*/*', limit: '256kb', verify })
  );
  transport.use(express.json({ limit: '256kb', verify }));
  // Nest remaps native SyntaxError before its filter sees body-parser's error type.
  // Preserve the established parser error while leaving all response serialization in the Nest filter.
  transport.use(
    (error: unknown, _request: CoreRequest, _response: Response, next: NextFunction) => {
      if (error instanceof SyntaxError && 'type' in error && error.type === 'entity.parse.failed')
        next(new ApiError(400, 'VALIDATION_FAILED'));
      else next(error);
    }
  );
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.register(options),
    new ExpressAdapter(transport),
    { bodyParser: false, logger: false, abortOnError: false }
  );
  app.useGlobalFilters(new CoreExceptionFilter());
  app.useGlobalInterceptors(new EnvelopeInterceptor());
  await app.init();
  return app;
}
