/**
 * RAG Metrics Controller
 * Exposes RAG metrics for monitoring
 *
 * TODO: Fix export of PrometheusExporter from SDK
 */

import { Controller, Get, Header } from '@nestjs/common';
// import { PrometheusExporter } from '@devflow/sdk/rag/metrics/prometheus-exporter';

@Controller('metrics/rag')
export class RagMetricsController {
  /**
   * GET /metrics/rag/prometheus
   * Export metrics in Prometheus format
   */
  @Get('prometheus')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  getPrometheusMetrics(): string {
    // return PrometheusExporter.export();
    return '# RAG metrics temporarily disabled\n';
  }

  /**
   * GET /metrics/rag/json
   * Export metrics as JSON for debugging
   */
  @Get('json')
  getJSONMetrics(): any {
    // const json = PrometheusExporter.exportJSON();
    // return JSON.parse(json);
    return { message: 'RAG metrics temporarily disabled' };
  }

  /**
   * GET /metrics/rag/summary
   * Get quick metrics summary
   */
  @Get('summary')
  getSummary(): any {
    // return PrometheusExporter.getSummary();
    return { message: 'RAG metrics temporarily disabled' };
  }
}
