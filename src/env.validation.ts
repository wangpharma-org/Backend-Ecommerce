import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  ACCESS_TOKEN_SECRET: Joi.string().required(),
  DB_HOST: Joi.string().required(),
  DB_NAME: Joi.string().required(),
  DB_PASSWORD: Joi.string().required(),
  DB_PORT: Joi.number().required(),
  DB_USERNAME: Joi.string().required(),
  DO_SPACES_BUCKET: Joi.string().required(),
  DO_SPACES_KEY: Joi.string().required(),
  DO_SPACES_SECRET: Joi.string().required(),
  KAFKA_BROKERS: Joi.string().required(),
  MAILGUN_API_KEY: Joi.string().required(),
  MAILGUN_DOMAIN: Joi.string().required(),
  SLACK_WEBHOOK_URL: Joi.string().required(),
  SYNCHRONIZE: Joi.boolean().default(false),
  PORT: Joi.number().default(3000),
});
