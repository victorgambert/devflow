/**
 * Billing Engine - Phase 10
 * Generates invoices from usage records
 */

import { PrismaClient } from '@prisma/client';
import { UsageMeteringService } from './usage-metering.service';

// Local type definitions (normally from Prisma schema)
export enum InvoiceStatus {
  DRAFT = 'DRAFT',
  OPEN = 'OPEN',
  PENDING = 'PENDING',
  PAID = 'PAID',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
  VOID = 'VOID',
}

export interface InvoiceLineItem {
  description: string;
  type: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
}

export interface CreateInvoiceInput {
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  dueDate?: Date;
  taxRate?: number; // ex: 0.20 for 20% VAT
}

export class BillingEngineService {
  constructor(
    private prisma: PrismaClient,
    private usageMetering: UsageMeteringService
  ) {}

  /**
   * Generate invoice for an organization
   */
  async generateInvoice(input: CreateInvoiceInput): Promise<string> {
    const { organizationId, periodStart, periodEnd, dueDate, taxRate = 0.0 } = input;

    // Get usage summary
    const summary = await this.usageMetering.getUsageSummary(
      organizationId,
      periodStart,
      periodEnd
    );

    if (summary.totalCost === 0) {
      throw new Error('No usage to invoice');
    }

    // Build line items
    const lineItems: InvoiceLineItem[] = summary.breakdown.map(b => ({
      description: this.getUsageDescription(b.type),
      type: b.type,
      quantity: b.quantity,
      unit: b.unit,
      unitPrice: b.unitPrice,
      total: b.totalCost,
    }));

    // Calculate totals
    const subtotal = summary.totalCost;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    // Generate invoice number
    const invoiceNumber = await this.generateInvoiceNumber(periodStart);

    // Get org
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!org) {
      throw new Error(`Organization not found: ${organizationId}`);
    }

    // Create invoice
    const invoice = await this.prisma.invoice.create({
      data: {
        organizationId,
        invoiceNumber,
        status: InvoiceStatus.OPEN,
        periodStart,
        periodEnd,
        subtotal,
        tax,
        total,
        currency: 'USD',
        lineItems: lineItems as any,
        dueDate: dueDate ?? this.getDefaultDueDate(),
      },
    });

    return invoice.id;
  }

  /**
   * Get usage description for invoice line item
   */
  private getUsageDescription(type: string): string {
    const descriptions: Record<string, string> = {
      TICKET_PROCESSED: 'Tickets Processed',
      CI_MINUTES: 'CI Minutes',
      LLM_TOKENS_INPUT: 'LLM Tokens (Input)',
      LLM_TOKENS_OUTPUT: 'LLM Tokens (Output)',
      PREVIEW_DEPLOY: 'Preview Deployments',
      PREVIEW_HOURS: 'Preview App Hours',
      STORAGE_GB_HOURS: 'Storage (GB·hours)',
      API_CALLS: 'API Calls',
    };
    return descriptions[type] ?? type;
  }

  /**
   * Generate invoice number (INV-YYYY-NNN)
   */
  private async generateInvoiceNumber(periodStart: Date): Promise<string> {
    const year = periodStart.getFullYear();
    const month = String(periodStart.getMonth() + 1).padStart(2, '0');

    // Count invoices for this year
    const count = await this.prisma.invoice.count({
      where: {
        invoiceNumber: {
          startsWith: `INV-${year}`,
        },
      },
    });

    const sequence = String(count + 1).padStart(4, '0');
    return `INV-${year}${month}-${sequence}`;
  }

  /**
   * Get default due date (30 days from now)
   */
  private getDefaultDueDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date;
  }

  /**
   * Generate monthly invoices for all organizations
   */
  async generateMonthlyInvoices(year: number, month: number): Promise<string[]> {
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59);

    // Get all organizations
    const orgs = await this.prisma.organization.findMany();

    const invoiceIds: string[] = [];

    for (const org of orgs) {
      try {
        const invoiceId = await this.generateInvoice({
          organizationId: org.id,
          periodStart,
          periodEnd,
        });
        invoiceIds.push(invoiceId);
      } catch (error) {
        console.error(`Failed to generate invoice for org ${org.slug}:`, error);
      }
    }

    return invoiceIds;
  }

  /**
   * Mark invoice as paid
   */
  async markAsPaid(invoiceId: string, paidAt?: Date): Promise<void> {
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceStatus.PAID,
        paidAt: paidAt ?? new Date(),
      },
    });
  }

  /**
   * Mark invoice as void
   */
  async voidInvoice(invoiceId: string): Promise<void> {
    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceStatus.VOID,
      },
    });
  }

  /**
   * Get invoices for an organization
   */
  async getInvoices(
    organizationId: string,
    options?: {
      status?: InvoiceStatus;
      limit?: number;
      offset?: number;
    }
  ): Promise<any[]> {
    return this.prisma.invoice.findMany({
      where: {
        organizationId,
        ...(options?.status && { status: options.status }),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit,
      skip: options?.offset,
    });
  }

  /**
   * Get invoice by ID
   */
  async getInvoice(invoiceId: string): Promise<any> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        organization: true,
      },
    });

    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }

    return invoice;
  }

  /**
   * Calculate upcoming invoice (preview for current period)
   */
  async calculateUpcomingInvoice(organizationId: string): Promise<{
    estimatedTotal: number;
    lineItems: InvoiceLineItem[];
    periodStart: Date;
    periodEnd: Date;
  }> {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const summary = await this.usageMetering.getUsageSummary(
      organizationId,
      periodStart,
      periodEnd
    );

    const lineItems: InvoiceLineItem[] = summary.breakdown.map(b => ({
      description: this.getUsageDescription(b.type),
      type: b.type,
      quantity: b.quantity,
      unit: b.unit,
      unitPrice: b.unitPrice,
      total: b.totalCost,
    }));

    return {
      estimatedTotal: summary.totalCost,
      lineItems,
      periodStart,
      periodEnd,
    };
  }

  /**
   * Get billing statistics for an organization
   */
  async getBillingStats(organizationId: string): Promise<{
    totalSpend: number;
    averageMonthly: number;
    currentMonthSpend: number;
    unpaidInvoices: number;
  }> {
    // Total spend (all paid invoices)
    const paid = await this.prisma.invoice.aggregate({
      where: {
        organizationId,
        status: InvoiceStatus.PAID,
      },
      _sum: { total: true },
      _count: true,
    });

    const totalSpend = paid._sum.total ?? 0;
    const invoiceCount = paid._count;

    // Average monthly (if we have at least 1 invoice)
    const averageMonthly = invoiceCount > 0 ? totalSpend / invoiceCount : 0;

    // Current month spend (usage so far)
    const upcoming = await this.calculateUpcomingInvoice(organizationId);
    const currentMonthSpend = upcoming.estimatedTotal;

    // Unpaid invoices count
    const unpaid = await this.prisma.invoice.count({
      where: {
        organizationId,
        status: InvoiceStatus.OPEN,
      },
    });

    return {
      totalSpend,
      averageMonthly,
      currentMonthSpend,
      unpaidInvoices: unpaid,
    };
  }
}



