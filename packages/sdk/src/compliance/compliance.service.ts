/**
 * Compliance Service - Phase 10
 * GDPR compliance: data retention, anonymization, deletion
 */

import { PrismaClient, DataRetentionPolicyType, AnonymizationAction } from '@prisma/client';
import * as crypto from 'crypto';

export interface DataRetentionConfig {
  type: DataRetentionPolicyType;
  retentionDays: number;
  autoDelete: boolean;
  autoAnonymize: boolean;
  description?: string;
}

export interface AnonymizationRequest {
  entityType: string;
  entityId: string;
  actions: AnonymizationAction[];
  reason: string;
  requestedBy?: string;
}

export class ComplianceService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create or update data retention policy
   */
  async setRetentionPolicy(config: DataRetentionConfig): Promise<void> {
    await this.prisma.dataRetentionPolicy.upsert({
      where: { type: config.type },
      create: {
        type: config.type,
        retentionDays: config.retentionDays,
        autoDelete: config.autoDelete,
        autoAnonymize: config.autoAnonymize,
        description: config.description,
      },
      update: {
        retentionDays: config.retentionDays,
        autoDelete: config.autoDelete,
        autoAnonymize: config.autoAnonymize,
        description: config.description,
      },
    });
  }

  /**
   * Get all retention policies
   */
  async getRetentionPolicies(): Promise<any[]> {
    return this.prisma.dataRetentionPolicy.findMany({
      where: { isActive: true },
    });
  }

  /**
   * Apply retention policies (delete/anonymize old data)
   * Should be run as a cron job (daily)
   */
  async applyRetentionPolicies(): Promise<{
    deleted: number;
    anonymized: number;
  }> {
    const policies = await this.getRetentionPolicies();
    let deleted = 0;
    let anonymized = 0;

    for (const policy of policies) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionDays);

      switch (policy.type) {
        case DataRetentionPolicyType.AUDIT_LOGS:
          if (policy.autoDelete) {
            const result = await this.prisma.auditLog.deleteMany({
              where: { createdAt: { lt: cutoffDate } },
            });
            deleted += result.count;
          } else if (policy.autoAnonymize) {
            const logs = await this.prisma.auditLog.findMany({
              where: { createdAt: { lt: cutoffDate } },
            });
            for (const log of logs) {
              await this.anonymizeAuditLog(log.id);
              anonymized++;
            }
          }
          break;

        case DataRetentionPolicyType.WORKFLOW_LOGS:
          if (policy.autoDelete) {
            const result = await this.prisma.workflowStageLog.deleteMany({
              where: { startedAt: { lt: cutoffDate } },
            });
            deleted += result.count;
          }
          break;

        case DataRetentionPolicyType.CI_LOGS:
          if (policy.autoDelete) {
            // Delete CI logs (stored in CI runs)
            const runs = await this.prisma.cIRun.findMany({
              where: { createdAt: { lt: cutoffDate } },
            });
            for (const run of runs) {
              await this.prisma.cIRun.update({
                where: { id: run.id },
                data: { logs: null }, // Clear logs but keep metadata
              });
              deleted++;
            }
          }
          break;

        case DataRetentionPolicyType.USAGE_RECORDS:
          if (policy.autoDelete) {
            const result = await this.prisma.usageRecord.deleteMany({
              where: { createdAt: { lt: cutoffDate } },
            });
            deleted += result.count;
          }
          break;

        case DataRetentionPolicyType.INVOICES:
          // Invoices usually have longer retention (7+ years for tax)
          // Only delete VOID invoices
          if (policy.autoDelete) {
            const result = await this.prisma.invoice.deleteMany({
              where: {
                status: 'VOID',
                createdAt: { lt: cutoffDate },
              },
            });
            deleted += result.count;
          }
          break;

        case DataRetentionPolicyType.USER_DATA:
          if (policy.autoAnonymize) {
            const users = await this.prisma.user.findMany({
              where: {
                lastLoginAt: { lt: cutoffDate },
              },
            });
            for (const user of users) {
              await this.anonymizeUser(user.id, 'retention_policy');
              anonymized++;
            }
          }
          break;
      }
    }

    return { deleted, anonymized };
  }

  /**
   * Anonymize audit log
   */
  private async anonymizeAuditLog(logId: string): Promise<void> {
    const log = await this.prisma.auditLog.findUnique({
      where: { id: logId },
    });

    if (!log) return;

    const beforeHash = this.hashData(log);

    await this.prisma.auditLog.update({
      where: { id: logId },
      data: {
        userId: null,
        ipAddress: null,
        userAgent: null,
      },
    });

    const updatedLog = await this.prisma.auditLog.findUnique({
      where: { id: logId },
    });
    const afterHash = this.hashData(updatedLog);

    await this.prisma.anonymizationLog.create({
      data: {
        entityType: 'audit_log',
        entityId: logId,
        actions: [
          AnonymizationAction.REMOVE_IP,
          AnonymizationAction.REMOVE_USER_AGENT,
        ],
        reason: 'retention_policy',
        beforeHash,
        afterHash,
      },
    });
  }

  /**
   * Anonymize user (GDPR right to be forgotten)
   */
  async anonymizeUser(userId: string, reason: string, requestedBy?: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    const beforeHash = this.hashData(user);

    // Anonymize user data
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@devflow.local`,
        name: '[DELETED]',
        avatar: null,
        ssoProvider: null,
        ssoId: null,
      },
    });

    const updatedUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    const afterHash = this.hashData(updatedUser);

    // Log anonymization
    await this.prisma.anonymizationLog.create({
      data: {
        entityType: 'user',
        entityId: userId,
        actions: [
          AnonymizationAction.HASH_EMAIL,
          AnonymizationAction.REMOVE_NAME,
          AnonymizationAction.FULL_ANONYMIZATION,
        ],
        reason,
        requestedBy,
        beforeHash,
        afterHash,
      },
    });
  }

  /**
   * Delete user and all related data (GDPR right to erasure)
   */
  async deleteUser(userId: string, requestedBy?: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Log before deletion
    await this.prisma.anonymizationLog.create({
      data: {
        entityType: 'user',
        entityId: userId,
        actions: [AnonymizationAction.FULL_ANONYMIZATION],
        reason: 'gdpr_erasure',
        requestedBy,
        beforeHash: this.hashData(user),
      },
    });

    // Delete user (cascade will delete related data)
    await this.prisma.user.delete({
      where: { id: userId },
    });
  }

  /**
   * Hash data for audit trail
   */
  private hashData(data: any): string {
    const json = JSON.stringify(data);
    return crypto.createHash('sha256').update(json).digest('hex');
  }

  /**
   * Export user data (GDPR right to data portability)
   */
  async exportUserData(userId: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        organizations: {
          include: {
            organization: true,
          },
        },
        apiKeys: true,
        dataExports: true,
      },
    });

    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
        ssoProvider: user.ssoProvider,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        gdprConsent: user.gdprConsent,
        gdprConsentAt: user.gdprConsentAt,
      },
      organizations: user.organizations.map(m => ({
        organization: m.organization.name,
        role: m.role,
        joinedAt: m.joinedAt,
      })),
      apiKeys: user.apiKeys.map(k => ({
        name: k.name,
        scopes: k.scopes,
        createdAt: k.createdAt,
        lastUsedAt: k.lastUsedAt,
      })),
      dataExports: user.dataExports.map(e => ({
        type: e.type,
        format: e.format,
        status: e.status,
        createdAt: e.createdAt,
      })),
    };
  }

  /**
   * Export organization data
   */
  async exportOrganizationData(organizationId: string): Promise<any> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        members: {
          include: {
            user: true,
          },
        },
        projects: {
          include: {
            project: true,
          },
        },
        usageRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1000, // Limit
        },
        invoices: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!org) {
      throw new Error(`Organization not found: ${organizationId}`);
    }

    return {
      organization: {
        id: org.id,
        slug: org.slug,
        name: org.name,
        tokenQuota: org.tokenQuota,
        costQuota: org.costQuota,
        createdAt: org.createdAt,
      },
      members: org.members.map(m => ({
        user: {
          email: m.user.email,
          name: m.user.name,
        },
        role: m.role,
        joinedAt: m.joinedAt,
      })),
      projects: org.projects.map(p => ({
        name: p.project.name,
        repository: p.project.repository,
        vcsDriver: p.vcsDriver,
        ciDriver: p.ciDriver,
        previewDriver: p.previewDriver,
      })),
      usage: org.usageRecords.map(u => ({
        type: u.type,
        quantity: u.quantity,
        unit: u.unit,
        totalCost: u.totalCost,
        periodStart: u.periodStart,
        periodEnd: u.periodEnd,
      })),
      invoices: org.invoices.map(i => ({
        invoiceNumber: i.invoiceNumber,
        status: i.status,
        periodStart: i.periodStart,
        periodEnd: i.periodEnd,
        total: i.total,
        currency: i.currency,
        paidAt: i.paidAt,
      })),
    };
  }

  /**
   * Record GDPR consent
   */
  async recordGDPRConsent(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        gdprConsent: true,
        gdprConsentAt: new Date(),
      },
    });
  }

  /**
   * Get anonymization logs for audit
   */
  async getAnonymizationLogs(options?: {
    entityType?: string;
    entityId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
  }): Promise<any[]> {
    return this.prisma.anonymizationLog.findMany({
      where: {
        ...(options?.entityType && { entityType: options.entityType }),
        ...(options?.entityId && { entityId: options.entityId }),
        ...(options?.from && options?.to && {
          createdAt: {
            gte: options.from,
            lte: options.to,
          },
        }),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit ?? 100,
    });
  }
}

