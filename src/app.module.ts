import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard } from "@nestjs/throttler";
import { typeOrmConfig } from "./config/typeorm.config";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";
import { CustomThrottlerGuard } from "./common/guards/rate-limit.guard";

// Modules
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { RecyclingPointsModule } from "./modules/recycling-points/recycling-points.module";
import { RecycleActionsModule } from "./modules/recycle-actions/recycle-actions.module";
import { VerificationModule } from "./modules/verification/verification.module";
import { AIVerificationModule } from "./modules/ai-verification/ai-verification.module";
import { TrustModule } from "./modules/trust/trust.module";
import { RewardsModule } from "./modules/rewards/rewards.module";
import { FraudModule } from "./modules/fraud/fraud.module";
import { AuditModule } from "./modules/audit/audit.module";
import { StorageModule } from "./modules/storage/storage.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env",
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        ...typeOrmConfig,
        url: configService.get("DATABASE_URL"),
      }),
      inject: [ConfigService],
    }),

    // Rate Limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minute
        limit: 100, // 100 requests per minute
      },
    ]),

    // Application Modules
    AuthModule,
    UsersModule,
    RecyclingPointsModule,
    RecycleActionsModule,
    VerificationModule,
    AIVerificationModule,
    TrustModule,
    RewardsModule,
    FraudModule,
    AuditModule,
    StorageModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: CustomThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
