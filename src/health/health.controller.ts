import { Controller, Get, HttpStatus, Res, Inject } from '@nestjs/common';
import { Response } from 'express';
import { PrismaService } from '../database/prisma.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('health')
export class HealthController {
  constructor(
    @Inject(PrismaService)
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get('live')
  checkLiveness(@Res() res: Response) {
    return res.status(HttpStatus.OK).json({
      status: 'live',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    });
  }

  @Public()
  @Get('ready')
  async checkReadiness(@Res() res: Response) {
    const startTime = Date.now();
    let databaseStatus = 'DOWN';
    let databaseLatencyMs = -1;

    try {
      await this.prisma.$queryRaw`SELECT 1;`;
      databaseStatus = 'UP';
      databaseLatencyMs = Date.now() - startTime;
    } catch {
      databaseStatus = 'DOWN';
    }

    const isReady = databaseStatus === 'UP';
    const statusCode = isReady ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(statusCode).json({
      status: isReady ? 'ready' : 'unready',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      dependencies: {
        database: {
          status: databaseStatus,
          latencyMs: databaseLatencyMs,
        },
      },
    });
  }

  @Public()
  @Get()
  async checkHealth(@Res() res: Response) {
    const startTime = Date.now();
    let databaseStatus = 'DOWN';
    let databaseLatencyMs = -1;

    try {
      await this.prisma.$queryRaw`SELECT 1;`;
      databaseStatus = 'UP';
      databaseLatencyMs = Date.now() - startTime;
    } catch {
      databaseStatus = 'DOWN';
    }

    const isHealthy = databaseStatus === 'UP';
    const statusCode = isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    return res.status(statusCode).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      checks: {
        database: {
          status: databaseStatus,
          latencyMs: databaseLatencyMs,
        },
        memory: {
          heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          rssMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        },
      },
    });
  }
}

