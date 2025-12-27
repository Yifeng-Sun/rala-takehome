# Monitoring Setup - Grafana, Prometheus & Exporters

Comprehensive monitoring stack for the Event Collaboration API with **Golden Signals** and **Kafka I/O metrics**.

## Overview

This monitoring solution provides:

### Golden Signals (Google SRE)
1. **Latency** - Request duration (P50, P95, P99)
2. **Traffic** - Request rate and throughput
3. **Errors** - Error rate and count
4. **Saturation** - CPU, Memory, Database connections

### Kafka Metrics
- Bytes In/Out per second
- Messages per second
- Consumer lag
- Topic partitions
- Producer/Consumer health

### Additional Metrics
- **Database**: Transactions, Tuple operations, Connections
- **Redis**: Operations/sec, Cache hit rate, Memory usage
- **System**: CPU, Memory, Disk, Network

## Architecture

```
┌─────────────────┐
│   Grafana       │ ← Visualization (Port 3001)
│   (UI)          │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│   Prometheus    │ ← Metrics Storage (Port 9090)
│   (TSDB)        │
└────────┬────────┘
         │
         ├─→ Node Exporter (9100)        ← System Metrics
         ├─→ Postgres Exporter (9187)    ← Database Metrics
         ├─→ Redis Exporter (9121)       ← Cache Metrics
         └─→ Kafka Exporter (9308)       ← Kafka Metrics
```

## Quick Start

### 1. Start the Main Application

```bash
docker-compose up -d
```

### 2. Start the Monitoring Stack

```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

### 3. Access Dashboards

- **Grafana**: http://localhost:3001
  - Username: `admin`
  - Password: `admin`
- **Prometheus**: http://localhost:9090

### 4. View the Dashboard

The Grafana dashboard is automatically provisioned and available at:
**Dashboards → Event Collaboration API - Golden Signals & Kafka Monitoring**

## Dashboard Sections

### 1. Golden Signals - Latency
- **Request Latency Graph**: P50, P95, P99 over time
- **P95 Gauge**: Current 95th percentile latency
- **P99 Gauge**: Current 99th percentile latency

**Thresholds**:
- ✅ Green: < 500ms
- ⚠️ Yellow: 500-1000ms
- ❌ Red: > 1000ms

### 2. Golden Signals - Traffic
- **Request Rate**: Total RPS over time
- **Current RPS Gauge**: Real-time request rate
- **Total Requests**: Cumulative count (1h)

**Thresholds**:
- ✅ Green: < 100 RPS
- ⚠️ Yellow: 100-500 RPS
- ❌ Red: > 500 RPS

### 3. Golden Signals - Errors
- **Error Rate %**: Percentage of 5xx responses
- **Current Error Rate Gauge**
- **Total Errors**: Count of errors (1h)

**Thresholds**:
- ✅ Green: < 1%
- ⚠️ Yellow: 1-5%
- ❌ Red: > 5%

### 4. Golden Signals - Saturation
- **CPU Usage**: System CPU utilization
- **Memory Usage**: RAM consumption
- **Database Connections**: Active PostgreSQL connections

**Thresholds**:
- ✅ Green: < 70%
- ⚠️ Yellow: 70-90%
- ❌ Red: > 90%

### 5. Kafka Metrics
- **Bytes In/Out**: Network I/O for Kafka
- **Message Rate**: Messages processed per second
- **Consumer Lag**: Backlog of unprocessed messages
- **Total Partitions**: Partition count

**Consumer Lag Thresholds**:
- ✅ Green: < 1000
- ⚠️ Yellow: 1000-10000
- ❌ Red: > 10000

### 6. Database Performance
- **Transaction Rate**: Commits and rollbacks per second
- **Tuple Operations**: Inserts, updates, deletes

### 7. Redis Performance
- **Operations/sec**: Command execution rate
- **Cache Hit Rate**: Percentage of successful cache hits
- **Memory Usage**: Current Redis memory consumption

## Configuration Files

### Directory Structure
```
monitoring/
├── prometheus.yml                          # Prometheus configuration
├── grafana/
│   ├── provisioning/
│   │   ├── datasources/
│   │   │   └── prometheus.yml             # Auto-configure Prometheus datasource
│   │   └── dashboards/
│   │       └── dashboards.yml             # Auto-load dashboards
│   └── dashboards/
│       └── event-collaboration-api.json   # Main dashboard
```

### Prometheus Configuration

Scrapes metrics every 15 seconds from:
- Node Exporter (system metrics)
- PostgreSQL Exporter
- Redis Exporter
- Kafka Exporter

### Exporters

#### Node Exporter (Port 9100)
- CPU usage
- Memory usage
- Disk I/O
- Network stats

#### PostgreSQL Exporter (Port 9187)
- Database connections
- Transaction rate
- Tuple operations
- Query performance

#### Redis Exporter (Port 9121)
- Command statistics
- Cache hit/miss rates
- Memory usage
- Client connections

#### Kafka Exporter (Port 9308)
- Broker metrics
- Topic metrics
- Consumer group lag
- Partition metrics

## Viewing Metrics

### Access Prometheus Directly

http://localhost:9090

**Example PromQL queries**:

```promql
# Request rate
sum(rate(http_requests_total[5m]))

# P95 latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Error rate
(sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))) * 100

# Kafka consumer lag
kafka_consumergroup_lag{topic="event-merge-requests"}

# Database connections
pg_stat_database_numbackends{datname="event_collaboration"}
```

### Access Individual Exporters

- **Node Exporter**: http://localhost:9100/metrics
- **PostgreSQL Exporter**: http://localhost:9187/metrics
- **Redis Exporter**: http://localhost:9121/metrics
- **Kafka Exporter**: http://localhost:9308/metrics

## Running Load Tests with Monitoring

### 1. Start All Services

```bash
# Start main application
docker-compose up -d

# Start monitoring
docker-compose -f docker-compose.monitoring.yml up -d

# Wait for everything to initialize
sleep 10
```

### 2. Open Grafana Dashboard

Open http://localhost:3001 in your browser

### 3. Run Load Test

```bash
k6 run loadtest-burst.js
```

### 4. Watch Metrics in Real-Time

The dashboard auto-refreshes every 5 seconds. Watch:
- Latency spike during burst
- RPS increase to ~500
- CPU/Memory saturation
- Kafka message throughput
- Database connection pool usage

## Troubleshooting

### Dashboard Not Showing Data

**Check Prometheus targets**:
```bash
# Open Prometheus UI
open http://localhost:9090/targets

# All targets should show "UP"
```

**Check exporter logs**:
```bash
docker logs rala-prometheus
docker logs rala-node-exporter
docker logs rala-postgres-exporter
docker logs rala-redis-exporter
docker logs rala-kafka-exporter
```

### No Kafka Metrics

Kafka exporter requires Kafka to be running and accessible:

```bash
# Check Kafka is running
docker ps | grep kafka

# Check Kafka exporter logs
docker logs rala-kafka-exporter

# Test Kafka connection
docker exec -it rala-kafka kafka-broker-api-versions --bootstrap-server localhost:9092
```

### Grafana Dashboard Not Auto-Loaded

Manually import the dashboard:

1. Open Grafana: http://localhost:3001
2. Go to **Dashboards → Import**
3. Upload: `monitoring/grafana/dashboards/event-collaboration-api.json`
4. Select **Prometheus** as datasource
5. Click **Import**

### High Memory Usage

Prometheus stores metrics in memory. To limit retention:

Edit `docker-compose.monitoring.yml`:
```yaml
prometheus:
  command:
    - '--storage.tsdb.retention.time=1d'  # Keep only 1 day
    - '--storage.tsdb.retention.size=1GB'  # Max 1GB storage
```

Then restart:
```bash
docker-compose -f docker-compose.monitoring.yml restart prometheus
```

## Alerting (Optional)

### Add Slack/Email Alerts

Create `monitoring/alerts.yml`:

```yaml
groups:
  - name: api_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: (sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))) * 100 > 5
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }}%"

      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency detected"
          description: "P95 latency is {{ $value }}s"

      - alert: KafkaConsumerLag
        expr: kafka_consumergroup_lag > 10000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High Kafka consumer lag"
          description: "Consumer lag is {{ $value }} messages"
```

Add to Prometheus configuration and configure Alertmanager.

## Performance Tips

### 1. Reduce Scrape Interval

For production, increase to 30s or 60s:

```yaml
# prometheus.yml
global:
  scrape_interval: 30s
```

### 2. Enable Compression

In Grafana datasource settings, enable **gzip compression**.

### 3. Use Recording Rules

Create aggregated metrics for frequently used queries:

```yaml
# prometheus.yml
groups:
  - name: api_metrics
    interval: 15s
    rules:
      - record: api:http_request_duration_seconds:p95
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

## Cleanup

### Stop Monitoring Stack

```bash
docker-compose -f docker-compose.monitoring.yml down
```

### Remove Volumes (Delete All Data)

```bash
docker-compose -f docker-compose.monitoring.yml down -v
```

## Advanced Configuration

### Custom Retention

```yaml
# docker-compose.monitoring.yml
prometheus:
  command:
    - '--storage.tsdb.retention.time=30d'
    - '--storage.tsdb.retention.size=10GB'
```

### External Prometheus

To use existing Prometheus instance:

1. Copy scrape configs from `monitoring/prometheus.yml`
2. Update `monitoring/grafana/provisioning/datasources/prometheus.yml` with external URL
3. Remove prometheus service from `docker-compose.monitoring.yml`

### InfluxDB Integration (for k6)

Add to `docker-compose.monitoring.yml`:

```yaml
influxdb:
  image: influxdb:1.8
  container_name: rala-influxdb
  ports:
    - '8086:8086'
  environment:
    - INFLUXDB_DB=k6
  networks:
    - rala-network
```

Then run k6 with:
```bash
k6 run --out influxdb=http://localhost:8086/k6 loadtest-burst.js
```

## Best Practices

1. **Monitor Continuously**: Keep monitoring running in development
2. **Set Baselines**: Establish normal operating ranges for your metrics
3. **Create Alerts**: Set up alerts for critical thresholds
4. **Regular Reviews**: Review metrics weekly to identify trends
5. **Document Incidents**: Note causes of anomalies for future reference

## Resources

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Google SRE Book - Monitoring](https://sre.google/sre-book/monitoring-distributed-systems/)
- [The Four Golden Signals](https://sre.google/sre-book/monitoring-distributed-systems/#xref_monitoring_golden-signals)
- [Kafka Monitoring](https://kafka.apache.org/documentation/#monitoring)

## Support

For issues or questions:
1. Check logs: `docker logs <container-name>`
2. Verify network: `docker network inspect rala-network`
3. Check Prometheus targets: http://localhost:9090/targets
4. Review Grafana datasource: http://localhost:3001/datasources
