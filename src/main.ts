import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import * as bodyParser from 'body-parser';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER));
  app.flushLogs();
  const configService = app.get(ConfigService);
  app.use(bodyParser.json({ limit: '50mb' }));
  app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
  app.setGlobalPrefix('api');
  app.enableCors();

  const enableKafka =
    configService.get<string>('ENABLE_KAFKA', 'true') === 'true';
  if (enableKafka) {
    const primaryBrokers = configService.get<string>(
      'KAFKA_BROKERS',
      'localhost:9092',
    );
    const primaryGroupId = configService.get<string>(
      'KAFKA_GROUP_ID',
      'consumer-ecommerce',
    );
    console.log('Connecting to primary Kafka:', primaryBrokers);
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.KAFKA,
      options: {
        client: {
          brokers: primaryBrokers.split(','),
        },
        consumer: {
          groupId: primaryGroupId,
        },
      },
    });
  }

  console.log('Analytics Kafka will be handled by dedicated service');

  if (enableKafka) {
    try {
      await app.startAllMicroservices();
      console.log('Core microservices started successfully');
    } catch (error) {
      console.error('Failed to start core microservices:', error);
      throw error; 
    }
  } else {
    console.log('Kafka is disabled for local development');
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
