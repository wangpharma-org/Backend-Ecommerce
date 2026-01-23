import * as winston from 'winston';
import 'winston-daily-rotate-file';

const dailyRotateFileTransport = new winston.transports.DailyRotateFile({
  dirname: 'logs/submitOrder', // เก็บไฟล์ไว้ในโฟลเดอร์นี้
  filename: 'submitOrder-%DATE%.log', // รูปแบบชื่อไฟล์
  datePattern: 'YYYY-MM-DD', // รูปแบบวันที่ในชื่อไฟล์
  zippedArchive: false, // ไม่ต้องบีบอัด
  maxSize: '20m', // จำกัดขนาดไฟล์
  maxFiles: '90d',
});

export const submitOrder = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
    ),
    transports: [
        dailyRotateFileTransport,
    ],
});
