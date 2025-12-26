import { Controller, Get, Header } from '@nestjs/common';
import { AIVerificationService } from '../ai-verification/ai-verification.service';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(
    private dataSource: DataSource,
    private aiVerificationService: AIVerificationService,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-cache, no-store, must-revalidate')
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
  ready() {
    return { ready: true };
  }

  @Get('live')
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
