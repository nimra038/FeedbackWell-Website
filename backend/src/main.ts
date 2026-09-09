import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  
  // Added the vercel URL to the default fallback origins
  const origins = (config.get<string>('CORS_ORIGINS') || 'http://localhost:3001,http://localhost:3000,https://feedback-well-website.vercel.app').split(',').map(value => value.trim());
  
  if (config.get('NODE_ENV') === 'production' && !config.get('CORS_ORIGINS')) throw new Error('CORS_ORIGINS is required in production');
  
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
  
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
