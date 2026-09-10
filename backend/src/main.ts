import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ExpressAdapter } from '@nestjs/platform-express';
import { INestApplication } from '@nestjs/common';

let cachedServer: any;

// Yeh helper function aapki saari custom settings apply karega (Local aur Vercel dono ke liye)
function setupApp(app: INestApplication) {
  const config = app.get(ConfigService);
  
  // Added the vercel URL to the default fallback origins
  const origins = (config.get<string>('CORS_ORIGINS') || 'http://localhost:3001,http://localhost:3000,https://feedback-well-website.vercel.app').split(',').map(value => value.trim());
  
  if (config.get('NODE_ENV') === 'production' && !config.get('CORS_ORIGINS')) {
    throw new Error('CORS_ORIGINS is required in production');
  }
  
  app.enableCors({
    origin: origins,
    credentials: true,
  });
  
  app.enableShutdownHooks();
  
  app.use((_req: unknown, res: { setHeader: (name: string, value: string) => void }, next: () => void) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  });
}

// Vercel Serverless environment ke liye setup
async function bootstrapServer() {
  if (!cachedServer) {
    const express = require('express');
    const expressApp = express();
    const app = await NestFactory.create(AppModule, new ExpressAdapter(expressApp));
    
    setupApp(app);
    
    await app.init();
    cachedServer = expressApp;
  }
  return cachedServer;
}

// Local development ke liye (Jab aap apne computer par run karein)
if (!process.env.VERCEL) {
  async function bootstrap() {
    const app = await NestFactory.create(AppModule);
    setupApp(app);
    await app.listen(process.env.PORT ?? 3000);
  }
  bootstrap();
}

// Vercel ke bundler ke liye entry point
export default async function (req: any, res: any) {
  const server = await bootstrapServer();
  return server(req, res);
}
