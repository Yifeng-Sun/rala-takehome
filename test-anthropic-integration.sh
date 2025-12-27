#!/bin/bash

API_URL="http://localhost:3000"

echo "==================================="
echo "Anthropic API Integration Test"
echo "==================================="
echo ""

# Create a fresh test user
echo "1. Creating new test user..."
NEW_USER=$(curl -s -X POST "$API_URL/users" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "anthropic-test-'$(date +%s)'@example.com",
    "name": "Anthropic Test",
    "timezone": "America/Los_Angeles"
  }')

USER_ID=$(echo $NEW_USER | jq -r '.id')
echo "   ✓ Created user: $USER_ID"
echo ""

# Create 3 overlapping events to merge
echo "2. Creating 3 overlapping events..."
curl -s -X POST "$API_URL/events/batch" \
  -H "Content-Type: application/json" \
  -d "{
    \"events\": [
      {
        \"title\": \"Design Review Meeting\",
        \"description\": \"Weekly design review\",
        \"startTime\": \"2025-02-01T14:00:00Z\",
        \"endTime\": \"2025-02-01T15:00:00Z\",
        \"status\": \"TODO\",
        \"userId\": \"$USER_ID\"
      },
      {
        \"title\": \"Product Planning Session\",
        \"description\": \"Q1 planning\",
        \"startTime\": \"2025-02-01T14:30:00Z\",
        \"endTime\": \"2025-02-01T15:30:00Z\",
        \"status\": \"TODO\",
        \"userId\": \"$USER_ID\"
      },
      {
        \"title\": \"Client Presentation\",
        \"description\": \"Demo for stakeholders\",
        \"startTime\": \"2025-02-01T14:45:00Z\",
        \"endTime\": \"2025-02-01\":00:00Z\",
        \"status\": \"TODO\",
        \"userId\": \"$USER_ID\"
      }
    ]
  }" > /dev/null

echo "   ✓ Events created"
echo ""

# Wait for processing
echo "3. Waiting for Kafka processing..."
sleep 3
echo ""

# Merge events
echo "4. Merging events (calling Anthropic API)..."
echo "   This will generate an AI summary using Claude..."
echo ""

MERGE_RESULT=$(curl -s -X POST "$API_URL/events/merge-all/$USER_ID")

# Check result
if echo "$MERGE_RESULT" | jq -e '.mergedEvents[0].aiSummary' > /dev/null 2>&1; then
  echo "   ✅ SUCCESS! Anthropic API integration working!"
  echo ""
  echo "Merged Event Details:"
  echo "====================="
  echo "$MERGE_RESULT" | jq '.mergedEvents[0] | {
    title: .title,
    startTime: .startTime,
    endTime: .endTime,
    mergedFrom: .mergedFrom,
    aiSummary: .aiSummary
  }'
  echo ""
  echo "AI-Generated Summary:"
  echo "─────────────────────"
  echo "$MERGE_RESULT" | jq -r '.mergedEvents[0].aiSummary'
else
  echo "   ❌ No AI summary found"
  echo "   Response:"
  echo "$MERGE_RESULT" | jq '.'
fi
