#!/bin/bash

# Configuration
API_URL="http://localhost:3000"
USER_ID="a353f6cd-baef-4365-b309-a076cc07379f"
TOTAL_EVENTS=888

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Creating Test Events with Overlaps${NC}"
echo -e "${BLUE}========================================${NC}"


# Function to generate event JSON
generate_events() {
  local start_index=$1
  local count=$2
  local output_file=$3

  echo "{\"events\":[" > "$output_file"

  for ((i=0; i<count; i++)); do
    # Calculate date offset (spread across 30 days)
    day_offset=$((i / 30))

    # Base time in hours (0-23)
    hour=$((i % 24))

    # Create intentional overlaps every 10 events
    if [ $((i % 10)) -eq 0 ] && [ $i -gt 0 ]; then
      # Overlap with previous event
      prev_hour=$(( (i - 1) % 24 ))
      hour=$prev_hour
    fi

    # Random minute (0, 15, 30, 45)
    minute=$(( (RANDOM % 4) * 15 ))

    # Duration: 30min, 1hr, 1.5hr, or 2hr
    duration_options=(30 60 90 120)
    duration=${duration_options[$((RANDOM % 4))]}

    # Calculate start and end times
    start_date=$(date -u -v+${day_offset}d -v${hour}H -v${minute}M -v0S +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -u -d "+${day_offset} days ${hour}:${minute}:00" +"%Y-%m-%dT%H:%M:%S.000Z")
    end_date=$(date -u -v+${day_offset}d -v${hour}H -v${minute}M -v0S -v+${duration}M +"%Y-%m-%dT%H:%M:%S.000Z" 2>/dev/null || date -u -d "+${day_offset} days ${hour}:${minute}:00 +${duration} minutes" +"%Y-%m-%dT%H:%M:%S.000Z")

    # Event status (mostly TODO, some IN_PROGRESS, few COMPLETED)
    status_rand=$((RANDOM % 100))
    if [ $status_rand -lt 70 ]; then
      status="TODO"
    elif [ $status_rand -lt 90 ]; then
      status="IN_PROGRESS"
    else
      status="COMPLETED"
    fi

    # Event titles with variety
    meeting_types=("Team Meeting" "Client Call" "Project Review" "1-on-1" "Sprint Planning" "Code Review" "Design Discussion" "All Hands" "Training Session" "Brainstorming")
    meeting_type=${meeting_types[$((RANDOM % 10))]}

    actual_index=$((start_index + i))

    # Generate JSON for this event
    cat >> "$output_file" << EOF
    {
      "title": "${meeting_type} #${actual_index}",
      "description": "Auto-generated test event for testing batch operations and conflict detection",
      "status": "${status}",
      "startTime": "${start_date}",
      "endTime": "${end_date}",
      "inviteeIds": ["${USER_ID}"]
    }
EOF

    # Add comma if not last event
    if [ $i -lt $((count - 1)) ]; then
      echo "," >> "$output_file"
    fi
  done

  echo "]}" >> "$output_file"
}

# Helper function to get current time in milliseconds
get_ms() {
  echo $(($(date +%s%N)/1000000))
}

# Step 2: Send events in smaller batches (100 events per batch to avoid payload size limits)
echo -e "\n${YELLOW}Step 2: Creating and sending events in batches...${NC}"

BATCH_SIZE=100
NUM_BATCHES=$(( (TOTAL_EVENTS + BATCH_SIZE - 1) / BATCH_SIZE ))  # Ceiling division
total_sent=0

# Performance tracking (in milliseconds)
script_start_time=$(get_ms)
total_generation_time=0
total_api_time=0
declare -a batch_times

for ((batch=0; batch<NUM_BATCHES; batch++)); do
  start_idx=$((batch * BATCH_SIZE))
  batch_start_time=$(get_ms)

  # Calculate remaining events
  remaining=$((TOTAL_EVENTS - start_idx))
  if [ $remaining -lt $BATCH_SIZE ]; then
    current_batch_size=$remaining
  else
    current_batch_size=$BATCH_SIZE
  fi

  echo -e "  ${BLUE}Batch $((batch + 1))/${NUM_BATCHES}: Generating ${current_batch_size} events (starting at #${start_idx})...${NC}"

  # Time the generation
  gen_start=$(get_ms)
  BATCH_FILE="/tmp/batch_${batch}.json"
  generate_events $start_idx $current_batch_size "$BATCH_FILE"
  gen_time=$(($(get_ms) - gen_start))
  total_generation_time=$((total_generation_time + gen_time))

  # Time the API call
  response=$(curl -X POST "${API_URL}/events/batch" \
    -H "Content-Type: application/json" \
    -d @"$BATCH_FILE" \
    -w "\nHTTP_STATUS:%{http_code}\nTIME_TOTAL:%{time_total}" \
    -s)

  # Extract curl timing info (convert seconds to ms)
  curl_time_sec=$(echo "$response" | grep "TIME_TOTAL" | cut -d: -f2)
  curl_time_ms=$(echo "$curl_time_sec * 1000" | bc 2>/dev/null | cut -d. -f1)
  total_api_time=$((total_api_time + curl_time_ms))

  http_code=$(echo "$response" | grep "HTTP_STATUS" | cut -d: -f2)

  batch_total_time=$(($(get_ms) - batch_start_time))
  batch_times[$batch]=$batch_total_time

  if [ "$http_code" == "201" ]; then
    total_sent=$((total_sent + current_batch_size))
    echo -e "  ${GREEN}✓ Batch $((batch + 1)) completed in ${batch_total_time}ms (gen: ${gen_time}ms, api: ${curl_time_ms}ms, HTTP $http_code)${NC}"
  else
    echo -e "  ${YELLOW}⚠ Batch $((batch + 1)) failed in ${batch_total_time}ms (HTTP $http_code)${NC}"
  fi

  # Cleanup temp file
  rm -f "$BATCH_FILE"

  # Small delay to avoid overwhelming the server
  sleep 0.5
done

batches_total_time=$(($(get_ms) - script_start_time))
echo -e "${GREEN}✓ All batches processed (${total_sent} events sent in ${batches_total_time}ms)${NC}"

# Step 6: Verify total count
echo -e "\n${YELLOW}Step 6: Fetching all events for user...${NC}"
all_events=$(curl -s -w "\nTIME_TOTAL:%{time_total}" "${API_URL}/events/user/${USER_ID}")
fetch_time_sec=$(echo "$all_events" | grep "TIME_TOTAL" | cut -d: -f2)
fetch_time_ms=$(echo "$fetch_time_sec * 1000" | bc 2>/dev/null | cut -d. -f1)
event_count=$(echo "$all_events" | grep -o '"id"' | wc -l | tr -d ' ')

echo -e "${GREEN}✓ Total events fetched: ${event_count} (took ${fetch_time_ms}ms)${NC}"

# Step 7: Check for conflicts
echo -e "\n${YELLOW}Step 7: Checking for scheduling conflicts...${NC}"
conflicts=$(curl -s -w "\nTIME_TOTAL:%{time_total}" "${API_URL}/events/conflicts/${USER_ID}")
conflicts_time_sec=$(echo "$conflicts" | grep "TIME_TOTAL" | cut -d: -f2)
conflicts_time_ms=$(echo "$conflicts_time_sec * 1000" | bc 2>/dev/null | cut -d. -f1)
conflict_count=$(echo "$conflicts" | grep -o '"id"' | wc -l | tr -d ' ')

echo -e "${GREEN}✓ Conflicting events found: ${conflict_count} (took ${conflicts_time_ms}ms)${NC}"

# Calculate performance metrics
total_script_time=$(($(get_ms) - script_start_time))
avg_batch_time=$((batches_total_time / NUM_BATCHES))
batches_total_sec=$(echo "scale=3; $batches_total_time / 1000" | bc 2>/dev/null || echo "0")
events_per_second=$(echo "scale=2; $total_sent / $batches_total_sec" | bc 2>/dev/null || echo "N/A")

# Summary
echo -e "\n${BLUE}========================================${NC}"
echo -e "${BLUE}Performance Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo -e "${YELLOW}Data:${NC}"
echo -e "  User ID: ${USER_ID}"
echo -e "  Events Created: ${event_count}/${TOTAL_EVENTS}"
echo -e "  Conflicts Detected: ${conflict_count}"
echo -e "\n${YELLOW}Performance (all times in milliseconds):${NC}"
echo -e "  Total Script Time: ${total_script_time} ms"
echo -e "  Batch Operations: ${batches_total_time} ms (${NUM_BATCHES} batches)"
echo -e "  Avg Time/Batch: ${avg_batch_time} ms"
echo -e "  Total Generation Time: ${total_generation_time} ms"
echo -e "  Total API Time: ${total_api_time} ms"
echo -e "  Throughput: ${events_per_second} events/second"
echo -e "\n${YELLOW}Read Operations:${NC}"
echo -e "  Fetch All Events: ${fetch_time_ms} ms (${event_count} events)"
echo -e "  Find Conflicts: ${conflicts_time_ms} ms (${conflict_count} conflicts)"
echo -e "\n${BLUE}API Endpoints:${NC}"
echo -e "  • All events: ${API_URL}/events/user/${USER_ID}"
echo -e "  • Conflicts: ${API_URL}/events/conflicts/${USER_ID}"
echo -e "  • Merge all: ${API_URL}/events/merge-all/${USER_ID}"
echo -e "  • Swagger: ${API_URL}/api"
echo -e "${BLUE}========================================${NC}\n"
