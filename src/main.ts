import './instrument';
import * as dotenv from 'dotenv';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AllExceptionsFilter } from './helpers/filters/all-exceptions.filter';
import helmet from 'helmet';

dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: true, // throws an error if unknown request param received
      whitelist: true, // automatically removes non-whitelisted properties
    }),
  );

  const httpAdapter = app.get(HttpAdapterHost);

  app.setGlobalPrefix('api');
  app.useGlobalFilters(new AllExceptionsFilter(httpAdapter));
  app.use(helmet());

  const config = new DocumentBuilder()
    .setTitle('Main BE')
    .setDescription('API description')
    .setVersion('1.0')
    .build();

  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('doc', app, documentFactory);

  const configService = app.get(ConfigService);
  const port: number = configService.get('port') ?? 3000;

  await app.listen(port, '0.0.0.0');
  console.log(
    `Server started on port ${port} in ${configService.get('nodeEnv')} mode`,
  );
}

bootstrap();
