import { plainToInstance, Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, MinLength, validateSync } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
  Staging = 'staging',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  @MinLength(10, { message: 'DATABASE_URL must be a valid PostgreSQL connection string' })
  DATABASE_URL: string;

  @IsString()
  @MinLength(16, { message: 'JWT_SECRET must be at least 16 characters long' })
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string = '15m';

  @IsString()
  @IsOptional()
  REFRESH_TOKEN_EXPIRES_IN: string = '7d';

  @IsString()
  @IsOptional()
  COOKIE_SECRET: string = 'waanofii_dev_cookie_signing_secret_2026!';

  @IsString()
  @IsOptional()
  APP_BASE_URL: string = 'http://localhost:3000';

  @IsString()
  @IsOptional()
  TENANT_BASE_DOMAIN: string = 'waanofii.local';

  @IsString()
  @IsOptional()
  CORS_ALLOWED_ORIGINS: string = 'http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:5173';
}

export function validateEnvironment(config: Record<string, unknown>) {
  const converted = { ...config };
  if (converted.PORT !== undefined && typeof converted.PORT === 'string') {
    converted.PORT = parseInt(converted.PORT, 10);
  }

  const validatedConfig = plainToInstance(EnvironmentVariables, converted, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    const errorMessages = errors.map((err) => Object.values(err.constraints || {})).flat();
    throw new Error(`Environment validation failed:\n - ${errorMessages.join('\n - ')}`);
  }
  return validatedConfig;
}
