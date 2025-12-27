# Burst Load Test - 500 Requests in 1 Second

This k6 load test sends **500 event creation requests** to the API within **1 second** to test system performance under burst traffic.

## Prerequisites

Install k6:

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows (Chocolatey)
choco install k6

# Or download from: https://k6.io/docs/get-started/installation/
```

## Running the Test

### Basic Usage

```bash
k6 run loadtest-burst.js
```

### With Custom Configuration

```bash
# Custom API URL
k6 run -e API_URL=http://localhost:3000 loadtest-burst.js

# Custom User ID
k6 run -e USER_ID=your-user-uuid-here loadtest-burst.js

# Both
k6 run -e API_URL=http://localhost:3000 -e USER_ID=a353f6cd-baef-4365-b309-a076cc07379f loadtest-burst.js
```

### Save Results to JSON

```bash
k6 run --out json=results.json loadtest-burst.js
```

### Run with Summary Report

```bash
k6 run --summary-export=summary.json loadtest-burst.js
```

## Test Configuration

- **Target Rate**: 500 requests/second
- **Duration**: 1 second
- **Total Requests**: 500
- **Pre-allocated VUs**: 50
- **Max VUs**: 500 (will scale up if needed)
- **Executor**: `constant-arrival-rate` (guarantees 500 requests regardless of response time)

## Performance Thresholds

The test will **PASS** if:

- ✅ **P50** (median) response time < 500ms
- ✅ **P95** response time < 2000ms (2 seconds)
- ✅ **P99** response time < 5000ms (5 seconds)
- ✅ **Error rate** < 10%
- ✅ **Success rate** > 90%

The test will **FAIL** if any threshold is breached.

## Metrics Tracked

### Standard HTTP Metrics
- `http_req_duration` - Request duration (connection + waiting + receiving)
- `http_req_failed` - Rate of failed requests
- `http_reqs` - Total number of requests
- `iterations` - Total number of test iterations

### Custom Metrics
- `event_creation_duration_ms` - Time to create event (milliseconds)
- `success_rate` - Percentage of successful requests
- `successful_requests` - Count of successful requests
- `failed_requests` - Count of failed requests

## Understanding the Output

### Example Output

```
running (01.2s), 000/050 VUs, 500 complete and 0 interrupted iterations

     ✓ status is 201
     ✓ has event id
     ✓ response time < 5s

     checks.........................: 100.00% ✓ 1500      ✗ 0
     data_received..................: 245 kB  204 kB/s
     data_sent......................: 156 kB  130 kB/s
     event_creation_duration_ms.....: avg=234.56 min=89.23 med=198.45 max=1234.56 p(90)=345.67 p(95)=456.78
     failed_requests................: 0       0/s
     http_req_blocked...............: avg=12.34ms min=1.23ms med=8.45ms max=56.78ms p(90)=23.45ms p(95)=34.56ms
     http_req_connecting............: avg=8.92ms  min=0.89ms med=6.12ms max=34.56ms p(90)=15.67ms p(95)=23.45ms
   ✓ http_req_duration..............: avg=234.56ms min=89.23ms med=198.45ms max=1234.56ms p(90)=345.67ms p(95)=456.78ms
       { expected_response:true }...: avg=234.56ms min=89.23ms med=198.45ms max=1234.56ms p(90)=345.67ms p(95)=456.78ms
   ✓ http_req_failed................: 0.00%   ✓ 0         ✗ 500
     http_req_receiving.............: avg=0.45ms   min=0.12ms med=0.34ms max=2.34ms p(90)=0.78ms p(95)=1.23ms
     http_req_sending...............: avg=0.23ms   min=0.05ms med=0.18ms max=1.12ms p(90)=0.45ms p(95)=0.67ms
     http_req_tls_handshaking.......: avg=0s       min=0s     med=0s     max=0s     p(90)=0s     p(95)=0s
     http_req_waiting...............: avg=233.88ms min=88.56ms med=197.89ms max=1233.12ms p(90)=344.56ms p(95)=455.67ms
     http_reqs......................: 500     416.67/s
     iteration_duration.............: avg=247.23ms min=92.45ms med=210.34ms max=1256.78ms p(90)=367.89ms p(95)=478.90ms
     iterations.....................: 500     416.67/s
   ✓ success_rate...................: 100.00% ✓ 500       ✗ 0
     successful_requests............: 500     416.67/s
     vus............................: 50      min=50      max=50
     vus_max........................: 50      min=50      max=50
```

### Key Metrics to Watch

1. **http_reqs**: Should be ~500 total
2. **http_req_duration (p95)**: Should be < 2000ms ✓
3. **http_req_failed**: Should be < 10% ✓
4. **success_rate**: Should be > 90% ✓
5. **Thresholds**: All should show ✓ (green checkmark)

### Success Indicators

- ✅ All checks passing (100%)
- ✅ 500 requests completed
- ✅ Error rate near 0%
- ✅ P95 response time under threshold
- ✅ All thresholds marked with ✓

### Warning Signs

- ⚠️ Error rate > 10%
- ⚠️ P95 response time > 2000ms
- ⚠️ Failed requests > 50
- ⚠️ Any threshold marked with ✗ (red X)

## Before Running the Test

1. **Start the API**:
   ```bash
   docker-compose up -d
   ```

2. **Verify API is running**:
   ```bash
   curl http://localhost:3000
   ```

3. **Check Docker logs** (optional):
   ```bash
   docker logs rala-api --follow
   ```

## After the Test

### View Created Events

```bash
# Fetch all events for the user
curl http://localhost:3000/events/user/a353f6cd-baef-4365-b309-a076cc07379f

# Check for conflicts
curl http://localhost:3000/events/conflicts/a353f6cd-baef-4365-b309-a076cc07379f
```

### Analyze Results

If you saved results to JSON:

```bash
# View summary with jq
cat results.json | jq -s 'group_by(.type) | map({type: .[0].type, count: length})'

# View metrics
cat summary.json | jq
```

### Monitor System Resources

While running the test, monitor:

```bash
# API container stats
docker stats rala-api

# API logs
docker logs rala-api --tail 50 --follow

# Database connections
docker exec -it rala-postgres psql -U rala_user -d event_collaboration -c "SELECT count(*) FROM pg_stat_activity;"
```

## Troubleshooting

### Test Fails Immediately

**Issue**: API not accessible
```bash
# Check if API is running
docker ps | grep rala-api

# Restart if needed
docker-compose restart api
```

### High Error Rates

**Issue**: Too many requests failing
- Check API logs: `docker logs rala-api`
- Check database connection limits
- Verify database is healthy: `docker logs rala-postgres`
- Consider increasing container resources

### Slow Response Times

**Issue**: P95 > threshold
- Check API container resources: `docker stats rala-api`
- Check database performance
- Monitor CPU/memory usage
- Consider database query optimization

### VU Allocation Issues

**Issue**: "not enough VUs allocated"
- Increase `preAllocatedVUs` in script
- Increase `maxVUs` if needed

## Example Complete Workflow

```bash
# 1. Ensure API is running
docker-compose up -d
sleep 5

# 2. Verify API health
curl http://localhost:3000

# 3. Run the burst test
k6 run --out json=results.json loadtest-burst.js

# 4. Check results
cat results.json | jq -s 'last | select(.type=="Point" and .metric=="http_req_duration") | .data.value' | head -10

# 5. View created events
curl http://localhost:3000/events/user/a353f6cd-baef-4365-b309-a076cc07379f | jq 'length'

# 6. Check API logs
docker logs rala-api --tail 100
```

## Performance Tuning Tips

If the test consistently fails thresholds:

1. **Increase API resources**:
   ```yaml
   # In docker-compose.yml
   api:
     deploy:
       resources:
         limits:
           cpus: '2'
           memory: 2G
   ```

2. **Optimize database connection pool**:
   - Check TypeORM connection pool settings
   - Increase pool size if needed

3. **Enable database query logging**:
   - Set `NODE_ENV=development` to see query performance

4. **Add Redis caching**:
   - Cache frequently accessed data
   - Reduce database queries

## Additional Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Executors](https://k6.io/docs/using-k6/scenarios/executors/)
- [k6 Metrics](https://k6.io/docs/using-k6/metrics/)
- [k6 Thresholds](https://k6.io/docs/using-k6/thresholds/)
