#!/bin/bash

# Stop all services (API + Monitoring)

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Stopping All Services${NC}"
echo -e "${BLUE}========================================${NC}\n"

echo -e "${YELLOW}Stopping monitoring stack...${NC}"
docker-compose -f docker-compose.monitoring.yml down
echo -e "${GREEN}✓ Monitoring stack stopped${NC}\n"

echo -e "${YELLOW}Stopping main application...${NC}"
docker-compose down
echo -e "${GREEN}✓ Main application stopped${NC}\n"

echo -e "${GREEN}All services stopped!${NC}"
echo -e "\nTo remove all data (volumes), run:"
echo -e "${BLUE}docker-compose down -v && docker-compose -f docker-compose.monitoring.yml down -v${NC}\n"
