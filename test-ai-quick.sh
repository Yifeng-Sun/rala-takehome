#!/bin/bash

USER_ID="528a21e9-9044-4647-8ce9-ad0209cc259c"
API_URL="http://localhost:3000"

echo "Testing AI Summary with user $USER_ID"
echo "======================================="
echo ""

# Create 3 overlapping events
echo "Creating 3 overlapping events..."
curl -s -X POST "$API_URL/events/batch" \
  -H "Content-Type: application/json" \
  -d "{
    \"events\": [
      {
        \"title\": \"Morning Standup\",
        \"description\": \"Daily team sync\",
        \"startTime\": \"2025-03-01T10:00:00Z\",
        \"endTime\": \"2025-03-01T10:30:00Z\",
        \"status\": \"TODO\",
        \"userId\": \"$USER_ID\"
      },
      {
        \"title\": \"Sprint Planning\",
        \"description\": \"Plan next sprint\",
        \"startTime\": \"2025-03-01T10:15:00Z\",
        \"endTime\": \"2025-03-01T11:00:00Z\",
        \"status\": \"TODO\",
        \"userId\": \"$USER_ID\"
      },
      {
        \"title\": \"Architecture Review\",
        \"description\": \"Review system design\",
        \"startTime\": \"2025-03-01T10:20:00Z\",
        \"endTime\": \"2025-03-01T11:15:00Z\",
        \"status\": \"TODO\",
        \"userId\": \"$USER_ID\"
      }
    ]
  }"

echo ""
echo ""
echo "Waiting 3 seconds for processing..."
sleep 3
echo ""

echo "Merging events (calling Anthropic API)..."
RESULT=$(curl -s -X POST "$API_URL/events/merge-all/$USER_ID")

echo ""
echo "Result:"
echo "$RESULT" | jq '.'

echo ""
echo "AI Summary:"
echo "$RESULT" | jq -r '.mergedEvents[0].aiSummary // "No summary generated"'
