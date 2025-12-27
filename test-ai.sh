#!/bin/bash

API_URL="http://localhost:3000"

echo "Testing Anthropic API Integration..."
echo "======================================"
echo ""

# Create a test user
echo "1. Creating test user..."
USER_RESPONSE=$(curl -s -X POST "$API_URL/users" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ai-test@example.com",
    "name": "AI Test User",
    "timezone": "America/New_York"
  }')

USER_ID=$(echo $USER_RESPONSE | jq -r '.id')
echo "   User created with ID: $USER_ID"
echo ""

# Create overlapping events
echo "2. Creating overlapping events..."

EVENT1=$(curl -s -X POST "$API_URL/events" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Team Meeting\",
    \"description\": \"Weekly sync\",
    \"startTime\": \"2025-01-15T10:00:00Z\",
    \"endTime\": \"2025-01-15T11:00:00Z\",
    \"userId\": \"$USER_ID\"
  }")

EVENT2=$(curl -s -X POST "$API_URL/events" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"Project Review\",
    \"description\": \"Quarterly review\",
    \"startTime\": \"2025-01-15T10:30:00Z\",
    \"endTime\": \"2025-01-15T11:30:00Z\",
    \"userId\": \"$USER_ID\"
  }")

echo "   Events created"
echo ""

# Wait for Kafka processing
echo "3. Waiting for event processing..."
sleep 5
echo ""

# Trigger merge
echo "4. Triggering merge (this will use Anthropic API)..."
MERGE_RESPONSE=$(curl -s -X POST "$API_URL/events/merge-all/$USER_ID")

echo ""
echo "Merge Response:"
echo "==============="
echo $MERGE_RESPONSE | jq '.'
echo ""

# Check for AI-generated summary
AI_SUMMARY=$(echo $MERGE_RESPONSE | jq -r '.mergedEvents[0].aiSummary // empty')

if [ -n "$AI_SUMMARY" ] && [ "$AI_SUMMARY" != "null" ]; then
  echo "✅ SUCCESS! Anthropic API is working!"
  echo "AI-Generated Summary: $AI_SUMMARY"
else
  echo "⚠️  No AI summary found (may be using mock mode)"
fi
