import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from 'express';

import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { INestApplication } from '@nestjs/common';

import { AppModule } from './app.module';

let cachedServer: Express | undefined;

/**
 * Local development aur Vercel dono ke liye
 * common application configuration.
 */
function setupApp(app: INestApplication): void {
  const configService = app.get(ConfigService);

  const configuredOrigins = configService.get<string>('CORS_ORIGINS');

  const origins = (
    configuredOrigins ||
    [
      'http://localhost:3001',
      'http://localhost:3000',
      'https://feedback-well-website.vercel.app',
    ].join(',')
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const nodeEnvironment =
    configService.get<string>('NODE_ENV') || process.env.NODE_ENV;

  if (nodeEnvironment === 'production' && !configuredOrigins) {
    throw new Error(
      'CORS_ORIGINS environment variable is required in production',
    );
  }

  app.enableCors({
    origin: origins,
    credentials: true,
  });

  app.use(
    (
      _request: Request,
      response: Response,
      next: NextFunction,
    ): void => {
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('Referrer-Policy', 'no-referrer');

      next();
    },
  );
}

/**
 * Vercel serverless function ke liye Express/Nest application.
 * Cached instance cold start ke baad reuse hogi.
 */
async function bootstrapServer(): Promise<Express> {
  if (cachedServer) {
    return cachedServer;
  }

  const expressApp = express();

  const nestApp = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressApp),
  );

  setupApp(nestApp);

  await nestApp.init();

  cachedServer = expressApp;

  return cachedServer;
}

/**
 * Local development server.
 */
async function bootstrapLocalServer(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  setupApp(app);

  app.enableShutdownHooks();

  const port = Number(process.env.PORT) || 3000;

  await app.listen(port);

  console.log(`Backend running on http://localhost:${port}`);
}

if (!process.env.VERCEL) {
  void bootstrapLocalServer();
}

/**
 * Vercel serverless function handler.
 */
export default async function handler(
  request: Request,
  response: Response,
): Promise<void> {
  const server = await bootstrapServer();

  server(request, response);
}
