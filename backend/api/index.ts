import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from '../src/app.module';
import { ConfigService } from '@nestjs/config';

const server = express();
let isInitialized = false;

async function bootstrapServer() {
  if (!isInitialized) {
    const app = await NestFactory.create(AppModule, new ExpressAdapter(server));
    const config = app.get(ConfigService);

    const origins = (
      config.get<string>('CORS_ORIGINS') ||
      'http://localhost:3001,http://localhost:3000,https://feedback-well-website.vercel.app'
    ).split(',').map((v) => v.trim());

    app.enableCors({ origin: origins, credentials: true });

    app.use((_req: unknown, res: { setHeader: (name: string, value: string) => void }, next: () => void) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Referrer-Policy', 'no-referrer');
      next();
    });

    await app.init();
    isInitialized = true;
  }
  return server;
}

export default async (req: express.Request, res: express.Response) => {
  const server = await bootstrapServer();
  server(req, res);
};
