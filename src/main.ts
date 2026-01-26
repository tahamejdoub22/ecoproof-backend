import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as compression from 'compression';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Request ID middleware (must be first)
  app.use(new RequestIdMiddleware().use.bind(new RequestIdMiddleware()));

  // Security
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));

  // Compression (optimize for mobile)
  app.use(compression({
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    },
    threshold: 1024, // Only compress responses > 1KB
  }));

  // CORS (optimized for mobile)
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    exposedHeaders: ['X-Request-ID', 'X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    maxAge: 86400, // 24 hours
  });

  // Global validation (with better error messages)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        const messages = errors.map((error) => {
          const constraints = Object.values(error.constraints || {});
          return `${error.property}: ${constraints.join(', ')}`;
        });
        return new ValidationPipe().createExceptionFactory()(errors);
      },
    }),
  );

  // Global interceptors (standardized responses)
  app.useGlobalInterceptors(new TransformInterceptor());

  // Global exception filter (user-friendly errors)
  app.useGlobalFilters(new HttpExceptionFilter());

  // API prefix
  app.setGlobalPrefix('api/v1');

  // Swagger documentation
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Ecoproof API')
      .setDescription('Smart Recycling Verification Backend API Documentation\n\n' +
        'This API provides endpoints for:\n' +
        '- User authentication and registration\n' +
        '- Recycling point management\n' +
        '- Recycling action submission and verification\n' +
        '- User profile and rewards\n' +
        '- Health checks\n\n' +
        'All endpoints use JWT Bearer authentication except for public endpoints.')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'JWT',
          description: 'Enter JWT token',
          in: 'header',
        },
        'JWT-auth',
      )
      .addTag('Authentication', 'User registration, login, and token refresh')
      .addTag('Users', 'User profile management')
      .addTag('Recycling Points', 'Recycling point information and location search')
      .addTag('Recycle Actions', 'Submit and manage recycling actions')
      .addTag('Health', 'Health check endpoints')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      customSiteTitle: 'Ecoproof API Docs',
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
        docExpansion: 'none',
        filter: true,
      },
    });
  }

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await app.close();
    process.exit(0);
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  console.log(`🚀 Ecoproof Backend running on: http://localhost:${port}`);
  console.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
}

bootstrap();
