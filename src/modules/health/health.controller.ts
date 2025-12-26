import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AIVerificationService } from '../ai-verification/ai-verification.service';
import { DataSource } from 'typeorm';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private dataSource: DataSource,
    private aiVerificationService: AIVerificationService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
  @ApiOperation({ summary: 'Health check', description: 'Check the health status of the application and its dependencies' })
  @ApiResponse({ status: 200, description: 'Health status of the application' })
  async health() {
    const dbHealthy = await this.checkDatabase();
    const aiHealth = await this.aiVerificationService.healthCheck();

    const healthy = dbHealthy && aiHealth.some((h) => h.healthy);

    return {
      status: healthy ? 'healthy' : 'degraded',
      checks: {
        database: dbHealthy ? 'healthy' : 'unhealthy',
        ai: aiHealth,
      },
      timestamp: new Date().toISOString(),
    };
  }

  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe', description: 'Kubernetes readiness probe endpoint' })
  @ApiResponse({ status: 200, description: 'Application is ready' })
  ready() {
    return { ready: true };
  }

  @Get('live')
  @ApiOperation({ summary: 'Liveness probe', description: 'Kubernetes liveness probe endpoint' })
  @ApiResponse({ status: 200, description: 'Application is alive' })
  live() {
    return { alive: true };
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.dataSource.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }
}
