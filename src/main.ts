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

  // Only connect to Kafka if not disabled (for local dev without Kafka)
  const disableKafka = configService.get<string>('DISABLE_KAFKA') === 'true';
  if (!disableKafka) {
    app.connectMicroservice<MicroserviceOptions>({
      transport: Transport.KAFKA,
      options: {
        client: {
          brokers: (
            configService.get<string>('KAFKA_BROKERS') ?? 'localhost:9092'
          ).split(','),
        },
        consumer: {
          groupId: configService.get<string>(
            'KAFKA_GROUP_ID',
            'consumer-ecommerce',
          ),
        },
      },
    });
    await app.startAllMicroservices();
  } else {
    console.log('Kafka is disabled for local development');
  }

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
