import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog, AuditActionType } from '../../entities/audit-log.entity';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepo: Repository<AuditLog>,
  ) {}

  /**
   * Log an audit event
   */
  async log(
    actionType: AuditActionType,
    options: {
      userId?: string;
      entityType?: string;
      entityId?: string;
      metadata?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
    } = {},
  ): Promise<void> {
    try {
      const log = this.auditLogRepo.create({
        actionType,
        userId: options.userId || null,
        entityType: options.entityType || null,
        entityId: options.entityId || null,
        metadata: options.metadata || null,
        ipAddress: options.ipAddress || null,
        userAgent: options.userAgent || null,
      });

      await this.auditLogRepo.save(log);
    } catch (error) {
      this.logger.error(`Failed to log audit event: ${error.message}`, error.stack);
      // Don't throw - audit logging should not break the flow
    }
  }
}
