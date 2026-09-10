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

import { AppModule } from './app.module.js';

let cachedServer: Express | null = null;

function setupApp(app: INestApplication): void {
  const configService = app.get(ConfigService);

  const corsOrigins =
    configService.get<string>('CORS_ORIGINS') ??
    [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://feedback-well-website.vercel.app',
    ].join(',');

  const allowedOrigins = corsOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins,
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

async function createVercelServer(): Promise<Express> {
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

  return expressApp;
}

async function startLocalServer(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  setupApp(app);
  app.enableShutdownHooks();

  const port = Number(process.env.PORT) || 3000;

  await app.listen(port);

  console.log(`Backend running on http://localhost:${port}`);
}

if (!process.env.VERCEL) {
  void startLocalServer();
}

export default async function handler(
  request: Request,
  response: Response,
): Promise<unknown> {
  const server = await createVercelServer();
  return server(request, response);
}
