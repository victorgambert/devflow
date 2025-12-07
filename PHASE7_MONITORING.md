# Phase 7: Monitoring & Observability

**Date**: December 6, 2025
**Status**: ✅ Complete

## Summary

Implemented Phase 7 of the RAG system: **Monitoring & Observability**. This phase provides comprehensive metrics collection, Prometheus exporter, Grafana dashboards, and alerting rules for monitoring the RAG system in production.

---

## Components Implemented

### 1. Metrics Collector (`metrics-collector.ts`)

**Purpose**: Centralized in-memory metrics collection for all RAG operations.

**Features**:
- Collects indexing metrics (duration, cost, success rate)
- Collects retrieval metrics (latency, relevance scores, cache hits)
- Tracks cache performance (hits, misses, latency)
- Monitors vector store operations (upsert, search, delete)
- Calculates percentiles (P50, P95, P99) for performance metrics
- Provides aggregated metrics with 24-hour rolling window

**Key Methods**:
```typescript
metricsCollector.recordIndexing(metrics: IndexingMetrics)
metricsCollector.recordRetrieval(metrics: RetrievalMetrics)
metricsCollector.recordCacheHit(latency: number)
metricsCollector.recordCacheMiss(latency: number)
metricsCollector.recordVectorStoreOperation(collection, operation, latency, metadata)
metricsCollector.getMetrics(): RagMetrics
metricsCollector.getCacheMetrics(): CacheMetrics
metricsCollector.getVectorStoreMetrics(): VectorStoreMetrics[]
```

**Integration**: All RAG components (cache, vector store, retrievers, indexers) now report metrics to the collector.

### 2. Instrumented Components

**Embeddings Cache** (`embeddings-cache.ts`):
- ✅ Records cache hits with latency
- ✅ Records cache misses with latency
- ✅ Tracks both get() and mget() operations

**Qdrant Vector Store** (`qdrant.provider.ts`):
- ✅ Records upsert operations with vector count
- ✅ Records search operations with results count and latency
- ✅ Records delete operations with latency

**Semantic Retriever** (`semantic-retriever.ts`):
- ✅ Records retrieval metrics (latency, scores, results count)
- ✅ Tracks query cost and token usage
- ✅ Stores metrics in both database and metrics collector

**Repository Indexer** (`repository-indexer.ts`):
- ✅ Records successful indexing metrics (duration, chunks, cost)
- ✅ Records failed indexing attempts
- ✅ Tracks indexing performance and success rate

### 3. Prometheus Exporter (`prometheus-exporter.ts`)

**Purpose**: Export metrics in Prometheus text format.

**Exported Metrics** (40+ metrics):

**Indexing**:
- `rag_repositories_indexed_total` - Total repositories indexed
- `rag_chunks_indexed_total` - Total chunks indexed
- `rag_indexing_duration_ms` - Average indexing duration
- `rag_indexing_cost_usd` - Total indexing cost
- `rag_indexing_success_rate` - Success rate (0-1)
- `rag_indexing_failures_total` - Total failed indexing operations
- `rag_indexing_duration_p50_ms` - P50 indexing latency
- `rag_indexing_duration_p95_ms` - P95 indexing latency

**Retrieval**:
- `rag_retrievals_total` - Total retrieval operations
- `rag_retrieval_duration_ms` - Average retrieval duration
- `rag_retrieval_relevance_score` - Average relevance score (0-1)
- `rag_retrieval_results_per_query` - Average results per query
- `rag_reranking_rate` - Queries using reranking (0-1)
- `rag_retrieval_duration_p50_ms` - P50 retrieval latency
- `rag_retrieval_duration_p95_ms` - P95 retrieval latency
- `rag_retrieval_duration_p99_ms` - P99 retrieval latency

**Cost**:
- `rag_embedding_cost_usd` - Total embedding cost
- `rag_reranking_cost_usd` - Total reranking cost
- `rag_cost_per_retrieval_usd` - Average cost per retrieval
- `rag_cost_per_index_usd` - Average cost per index
- `rag_monthly_cost_usd` - Estimated monthly cost

**Cache**:
- `rag_cache_hits_total` - Total cache hits
- `rag_cache_misses_total` - Total cache misses
- `rag_cache_hit_rate` - Cache hit rate (0-1)
- `rag_cache_hit_latency_ms` - Average cache hit latency
- `rag_cache_miss_latency_ms` - Average cache miss latency

**Quality**:
- `rag_average_chunk_size_bytes` - Average chunk size
- `rag_average_chunks_per_file` - Average chunks per file
- `rag_index_freshness_days` - Average index age in days
- `rag_vector_score` - Average vector similarity score

**Vector Store** (per collection):
- `rag_vectorstore_vectors_total{collection}` - Total vectors
- `rag_vectorstore_indexed_vectors{collection}` - Indexed vectors
- `rag_vectorstore_query_latency_ms{collection}` - Query latency
- `rag_vectorstore_memory_bytes{collection}` - Memory usage

**Health**:
- `rag_qdrant_status` - Qdrant health (1=healthy, 0.5=degraded, 0=down)
- `rag_redis_status` - Redis health (1=healthy, 0.5=degraded, 0=down)
- `rag_database_status` - Database health (1=healthy, 0.5=degraded, 0=down)

**Helper Methods**:
```typescript
PrometheusExporter.export(): string           // Prometheus text format
PrometheusExporter.exportJSON(): string       // JSON format for debugging
PrometheusExporter.getSummary(): object       // Quick summary
```

### 4. API Endpoints (`rag-metrics.controller.ts`)

**Endpoints**:

- `GET /metrics/rag/prometheus` - Prometheus text format
  - Content-Type: `text/plain; version=0.0.4; charset=utf-8`
  - Use with Prometheus scraping

- `GET /metrics/rag/json` - JSON format
  - Content-Type: `application/json`
  - For debugging and manual inspection

- `GET /metrics/rag/summary` - Quick summary
  - Human-readable summary of key metrics

**Example Response** (`/metrics/rag/summary`):
```json
{
  "indexing": {
    "total": 5,
    "failed": 0,
    "avgDuration": "45.2s",
    "cost": "$0.0012"
  },
  "retrieval": {
    "total": 150,
    "avgLatency": "180ms",
    "avgScore": "72.5%"
  },
  "cache": {
    "hitRate": "68.3%",
    "avgHitLatency": "8.5ms"
  },
  "health": {
    "qdrant": "healthy",
    "redis": "healthy",
    "database": "healthy"
  }
}
```

### 5. Grafana Dashboard (`rag-metrics.json`)

**Purpose**: Visual monitoring dashboard for RAG system.

**Panels** (14 panels):

1. **Retrieval Performance** (Graph)
   - P50, P95, P99 latency over time
   - Identify performance degradation

2. **Cache Hit Rate** (Stat)
   - Current cache hit rate with thresholds
   - Green: >70%, Yellow: 50-70%, Red: <50%

3. **Average Relevance Score** (Stat)
   - Current relevance score with thresholds
   - Green: >75%, Yellow: 60-75%, Red: <60%

4. **Total Retrievals** (Stat)
   - Retrieval rate (requests per second)

5. **Indexing Success Rate** (Stat)
   - Success rate with thresholds
   - Green: >95%, Yellow: 80-95%, Red: <80%

6. **Indexing Duration** (Graph)
   - P50 and P95 indexing time over time

7. **Cache Performance** (Graph)
   - Hit vs miss latency comparison

8. **Cost Metrics** (Graph)
   - Embedding, reranking, and indexing costs per hour

9. **Monthly Cost Estimate** (Stat)
   - Projected monthly cost with thresholds

10. **Cost per Retrieval** (Stat)
    - Average cost per million retrievals

11. **Vector Store Vectors** (Stat)
    - Total vectors in collection

12. **Vector Store Query Latency** (Stat)
    - Average query latency

13. **System Health** (Stat)
    - Qdrant, Redis, Database status

14. **Quality Metrics** (Table)
    - Chunk size, chunks/file, freshness, vector scores

**Installation**:
1. Copy `config/grafana/dashboards/rag-metrics.json` to Grafana
2. Import dashboard via Grafana UI
3. Dashboard ID will be auto-assigned

### 6. Alerting Rules (`rag-alerts.yml`)

**Purpose**: Proactive monitoring and incident detection.

**Alert Categories** (25 alerts):

**Performance Alerts**:
- `HighRetrievalLatency` - P95 > 500ms for 5min (warning)
- `CriticalRetrievalLatency` - P99 > 1000ms for 5min (critical)
- `HighIndexingDuration` - P95 > 5min for 10min (warning)

**Quality Alerts**:
- `LowRelevanceScore` - Avg < 60% for 10min (warning)
- `CriticalLowRelevanceScore` - Avg < 40% for 5min (critical)

**Cache Alerts**:
- `LowCacheHitRate` - < 50% for 15min (warning)
- `CriticalLowCacheHitRate` - < 30% for 10min (critical)

**Cost Alerts**:
- `HighMonthlyCost` - > $100 for 1h (warning)
- `CriticalMonthlyCost` - > $500 for 30min (critical)
- `HighCostPerRetrieval` - > $0.001 for 1h (warning)

**Indexing Alerts**:
- `IndexingFailureRate` - > 10% for 10min (warning)
- `CriticalIndexingFailures` - > 30% for 5min (critical)
- `LowIndexingSuccessRate` - < 80% for 15min (warning)

**Health Alerts**:
- `QdrantDown` - Unreachable for 1min (critical)
- `QdrantDegraded` - Degraded for 5min (warning)
- `RedisDown` - Unreachable for 1min (critical)
- `RedisDegraded` - Degraded for 5min (warning)

**Quality Degradation**:
- `StaleIndex` - > 14 days old (warning)
- `CriticalStaleIndex` - > 30 days old (critical)

**Vector Store**:
- `HighVectorStoreQueryLatency` - > 100ms for 10min (warning)

**Anomaly Detection**:
- `SuddenRetrievalSpike` - 2x increase in 5min (info)
- `NoRetrievalsRecent` - 0 retrievals in 30min (warning)

**Configuration**:
```yaml
# Add to Prometheus config
rule_files:
  - 'alerts/rag-alerts.yml'

# Alert Manager integration
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

---

## Setup Instructions

### 1. Configure Prometheus

Add to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'devflow-rag'
    scrape_interval: 30s
    static_configs:
      - targets: ['api:3000']
    metrics_path: '/metrics/rag/prometheus'

rule_files:
  - 'alerts/rag-alerts.yml'
```

### 2. Install Grafana Dashboard

**Option 1: Via UI**
1. Open Grafana (http://localhost:3001)
2. Navigate to Dashboards → Import
3. Upload `config/grafana/dashboards/rag-metrics.json`
4. Select Prometheus data source
5. Click Import

**Option 2: Via Provisioning**
```yaml
# config/grafana/provisioning/dashboards/rag.yml
apiVersion: 1

providers:
  - name: 'RAG'
    orgId: 1
    folder: 'DevFlow'
    type: file
    options:
      path: /etc/grafana/dashboards
```

Copy dashboard file to provisioning directory.

### 3. Configure Alerting

**Alert Manager** (`alertmanager.yml`):
```yaml
route:
  receiver: 'slack-devflow'
  group_by: ['alertname', 'severity']
  group_wait: 10s
  group_interval: 5m
  repeat_interval: 3h

receivers:
  - name: 'slack-devflow'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
        channel: '#devflow-alerts'
        title: '{{ .GroupLabels.alertname }}'
        text: '{{ .CommonAnnotations.description }}'
```

### 4. Start Monitoring Stack

```bash
# Start services
docker-compose up -d prometheus grafana alertmanager

# Verify Prometheus targets
curl http://localhost:9090/api/v1/targets

# Verify metrics endpoint
curl http://localhost:3000/metrics/rag/prometheus

# Check Grafana
open http://localhost:3001
```

---

## Usage

### Query Metrics Directly

**Prometheus queries**:
```promql
# Average retrieval latency over last hour
rate(rag_retrieval_duration_ms[1h])

# Cache hit rate
rag_cache_hit_rate * 100

# Cost per day
sum(rate(rag_embedding_cost_usd[1d])) + sum(rate(rag_reranking_cost_usd[1d]))

# P95 latency by time of day
rag_retrieval_duration_p95_ms
```

### API Queries

**Get summary**:
```bash
curl http://localhost:3000/metrics/rag/summary | jq
```

**Get Prometheus format**:
```bash
curl http://localhost:3000/metrics/rag/prometheus
```

**Get JSON format**:
```bash
curl http://localhost:3000/metrics/rag/json | jq '.rag.retrieval'
```

### Programmatic Access

```typescript
import { metricsCollector } from '@devflow/sdk/rag/metrics/metrics-collector';
import { PrometheusExporter } from '@devflow/sdk/rag/metrics/prometheus-exporter';

// Get current metrics
const metrics = metricsCollector.getMetrics();
console.log('Cache hit rate:', metrics.retrieval.cacheHitRate);

// Export for Prometheus
const prometheus = PrometheusExporter.export();

// Get summary
const summary = PrometheusExporter.getSummary();
console.log('Monthly cost:', summary.indexing.cost);
```

---

## Metrics Interpretation

### Performance Metrics

**Good**:
- P50 retrieval: < 200ms
- P95 retrieval: < 300ms
- P99 retrieval: < 500ms
- Cache hit rate: > 70%

**Warning**:
- P95 retrieval: 300-500ms
- Cache hit rate: 50-70%
- Relevance score: 60-75%

**Critical**:
- P99 retrieval: > 1000ms
- Cache hit rate: < 30%
- Relevance score: < 40%

### Cost Metrics

**Typical Costs**:
- Embedding: $0.000002 per query
- Reranking: $0.0003 per query
- Indexing: $0.0001-0.0005 per repo

**Monthly Projections**:
- Light usage (100 queries/day): $5-10/month
- Medium usage (1000 queries/day): $50-100/month
- Heavy usage (10000 queries/day): $500-1000/month

### Quality Metrics

**Good**:
- Relevance score: > 75%
- Vector score: > 0.7
- Index freshness: < 7 days

**Warning**:
- Relevance score: 60-75%
- Vector score: 0.5-0.7
- Index freshness: 7-14 days

**Critical**:
- Relevance score: < 60%
- Vector score: < 0.5
- Index freshness: > 30 days

---

## Troubleshooting

### No Metrics Appearing

**Check metrics endpoint**:
```bash
curl http://localhost:3000/metrics/rag/summary
```

If empty:
1. Verify RAG components are being used
2. Check that metrics collector is imported
3. Run a test indexing/retrieval operation

### Prometheus Not Scraping

**Check Prometheus targets**:
```bash
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.scrapePool == "devflow-rag")'
```

Common issues:
- Wrong metrics_path (use `/metrics/rag/prometheus`)
- API not accessible from Prometheus container
- Firewall blocking scraping

### Grafana Dashboard Not Showing Data

1. Verify Prometheus data source is configured
2. Check time range (metrics only available after first operations)
3. Verify Prometheus is scraping successfully
4. Check dashboard panel queries for errors

### Alerts Not Firing

**Check alert status**:
```bash
curl http://localhost:9090/api/v1/rules | jq '.data.groups[] | select(.name == "rag_alerts")'
```

Common issues:
- Alert rules not loaded (check Prometheus logs)
- Thresholds not met yet
- Alert Manager not configured
- Notification channel not working

---

## Best Practices

### 1. Monitoring Strategy

- **Watch trends**, not absolute values
- Set up **baseline** metrics for your usage
- Review metrics **weekly** to identify patterns
- Adjust alert thresholds based on actual usage

### 2. Cost Optimization

- Monitor `rag_monthly_cost_usd` daily
- Optimize reranking usage for expensive queries
- Increase cache TTL if hit rate is low
- Use incremental indexing instead of full re-index

### 3. Performance Tuning

- If P95 > 500ms, investigate:
  - Vector store performance
  - Cache configuration
  - Query complexity
  - Network latency

- If cache hit rate < 50%:
  - Increase Redis TTL
  - Check if queries are similar enough
  - Verify cache is working (check Redis keys)

### 4. Quality Assurance

- Review relevance scores weekly
- Investigate if scores drop below 70%
- Re-index if index freshness > 14 days
- Test with sample queries regularly

---

## Advanced Configuration

### Custom Metrics

Add custom metrics to components:

```typescript
import { metricsCollector } from '@devflow/sdk/rag/metrics/metrics-collector';

// In your custom component
metricsCollector.recordRetrieval({
  retrievalId: 'custom-123',
  projectId: 'proj-456',
  query: 'my custom query',
  method: 'hybrid',
  resultsCount: 10,
  averageScore: 0.85,
  retrievalTime: 250,
  rerankTime: 500,
  cacheHit: true,
  cost: 0.0003,
  timestamp: new Date(),
});
```

### Custom Alerts

Add to `rag-alerts.yml`:

```yaml
- alert: CustomAlert
  expr: your_custom_metric > threshold
  for: 5m
  labels:
    severity: warning
    component: rag
  annotations:
    summary: "Custom alert triggered"
    description: "Your custom condition met"
```

### Retention Policy

Configure Prometheus retention:

```yaml
# prometheus.yml
global:
  scrape_interval: 30s
  evaluation_interval: 30s

# CLI flags
--storage.tsdb.retention.time=30d
--storage.tsdb.retention.size=50GB
```

---

## Files Created/Modified

### Created

1. `packages/sdk/src/rag/metrics/metrics-collector.ts` - Metrics collection service
2. `packages/sdk/src/rag/metrics/prometheus-exporter.ts` - Prometheus exporter
3. `packages/api/src/metrics/rag-metrics.controller.ts` - API endpoints
4. `config/grafana/dashboards/rag-metrics.json` - Grafana dashboard
5. `config/prometheus/alerts/rag-alerts.yml` - Alerting rules
6. `PHASE7_MONITORING.md` - This documentation

### Modified

1. `packages/sdk/src/rag/cache/embeddings-cache.ts` - Added metrics recording
2. `packages/sdk/src/rag/vector-store/qdrant.provider.ts` - Added metrics recording
3. `packages/sdk/src/rag/retrieval/semantic-retriever.ts` - Added metrics recording
4. `packages/sdk/src/rag/indexing/repository-indexer.ts` - Added metrics recording

**Total Changes**: 10 files (6 new, 4 modified)

---

## Conclusion

Phase 7 provides production-ready monitoring for the RAG system:

- ✅ **Metrics Collection**: Comprehensive metrics from all RAG components
- ✅ **Prometheus Export**: Standard format for Prometheus scraping
- ✅ **Grafana Dashboard**: Visual monitoring with 14 panels
- ✅ **Alerting Rules**: 25 proactive alerts for incidents
- ✅ **API Endpoints**: REST API for programmatic access
- ✅ **Documentation**: Complete setup and usage guide

The RAG system is now **fully observable** and ready for production monitoring!

---

## Next Steps

1. **Set up Prometheus and Grafana** in your environment
2. **Configure alert channels** (Slack, Email, PagerDuty)
3. **Establish baselines** for your usage patterns
4. **Review metrics weekly** and adjust thresholds
5. **Optimize based on metrics** (cost, performance, quality)

---

## Questions?

- Metrics collector: `packages/sdk/src/rag/metrics/metrics-collector.ts`
- Prometheus exporter: `packages/sdk/src/rag/metrics/prometheus-exporter.ts`
- API endpoints: `packages/api/src/metrics/rag-metrics.controller.ts`
- Grafana dashboard: `config/grafana/dashboards/rag-metrics.json`
- Alerting rules: `config/prometheus/alerts/rag-alerts.yml`
- Full plan: `/Users/victorgambert/.claude/plans/zazzy-spinning-quail.md`

**Status**: Phase 7 complete - RAG system fully monitored! 🎯
