import { Module } from '@nestjs/common';
import { WinstonModule, utilities as nestWinstonUtilities } from 'nest-winston';
import { mkdirSync } from 'node:fs';
import * as winston from 'winston';
import 'winston-daily-rotate-file';

try {
  mkdirSync('logs/app', { recursive: true });
} catch {
}

@Module({
  imports: [
    WinstonModule.forRoot({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      transports: [new winston.transports.Console()],
    }),
  ],
})
export class LoggerModule {}
