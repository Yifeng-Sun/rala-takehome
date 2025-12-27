#!/bin/bash

# Start Event Collaboration API with Full Monitoring Stack
# This script starts the main application and monitoring services

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Event Collaboration API + Monitoring${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi

# Step 1: Start main application
echo -e "${YELLOW}Step 1: Starting main application...${NC}"
docker-compose up -d

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to start main application${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Main application started${NC}\n"

# Step 2: Wait for services to be healthy
echo -e "${YELLOW}Step 2: Waiting for services to be healthy...${NC}"
sleep 5

# Check if API is responsive
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ API is healthy${NC}\n"
        break
    fi
    attempt=$((attempt + 1))
    echo -n "."
    sleep 1
done

if [ $attempt -eq $max_attempts ]; then
    echo -e "\n${RED}API failed to start${NC}"
    docker logs rala-api --tail 50
    exit 1
fi

# Step 3: Start monitoring stack
echo -e "${YELLOW}Step 3: Starting monitoring stack...${NC}"
docker-compose -f docker-compose.monitoring.yml up -d

if [ $? -ne 0 ]; then
    echo -e "${RED}Failed to start monitoring stack${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Monitoring stack started${NC}\n"

# Step 4: Wait for Grafana to be ready
echo -e "${YELLOW}Step 4: Waiting for Grafana to be ready...${NC}"
sleep 10

attempt=0
while [ $attempt -lt 30 ]; do
    if curl -s http://localhost:3001 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Grafana is ready${NC}\n"
        break
    fi
    attempt=$((attempt + 1))
    echo -n "."
    sleep 1
done

# Display status
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Services Status${NC}"
echo -e "${BLUE}========================================${NC}"

# Check each service
services=(
    "rala-postgres:PostgreSQL"
    "rala-redis:Redis"
    "rala-kafka:Kafka"
    "rala-api:API"
    "rala-prometheus:Prometheus"
    "rala-grafana:Grafana"
    "rala-node-exporter:Node Exporter"
    "rala-postgres-exporter:PostgreSQL Exporter"
    "rala-redis-exporter:Redis Exporter"
    "rala-kafka-exporter:Kafka Exporter"
)

for service_info in "${services[@]}"; do
    container="${service_info%%:*}"
    name="${service_info##*:}"

    if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
        echo -e "${GREEN}✓${NC} ${name} (${container})"
    else
        echo -e "${RED}✗${NC} ${name} (${container}) - NOT RUNNING"
    fi
done

echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}Access URLs${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}API:${NC}"
echo -e "  • REST API: http://localhost:3000"
echo -e "  • Swagger: http://localhost:3000/api"
echo -e ""
echo -e "${GREEN}Monitoring:${NC}"
echo -e "  • Grafana: http://localhost:3001 (admin/admin)"
echo -e "  • Prometheus: http://localhost:9090"
echo -e ""
echo -e "${GREEN}Exporters:${NC}"
echo -e "  • Node Exporter: http://localhost:9100/metrics"
echo -e "  • PostgreSQL Exporter: http://localhost:9187/metrics"
echo -e "  • Redis Exporter: http://localhost:9121/metrics"
echo -e "  • Kafka Exporter: http://localhost:9308/metrics"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${YELLOW}Quick Commands:${NC}"
echo -e "  • View all logs: ${BLUE}docker-compose logs -f${NC}"
echo -e "  • View API logs: ${BLUE}docker logs rala-api -f${NC}"
echo -e "  • Stop all: ${BLUE}./stop-all.sh${NC} or ${BLUE}docker-compose down && docker-compose -f docker-compose.monitoring.yml down${NC}"
echo -e "  • Run load test: ${BLUE}k6 run loadtest-burst.js${NC}"
echo -e ""

echo -e "${GREEN}All services are running!${NC}"
echo -e "Open Grafana dashboard: ${BLUE}http://localhost:3001${NC}\n"

# Optional: Open Grafana in browser
if command -v open &> /dev/null; then
    read -p "Open Grafana in browser? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        open http://localhost:3001
    fi
elif command -v xdg-open &> /dev/null; then
    read -p "Open Grafana in browser? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        xdg-open http://localhost:3001
    fi
fi
