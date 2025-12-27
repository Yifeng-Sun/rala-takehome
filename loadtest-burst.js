import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// Custom metrics
const eventCreationDuration = new Trend('event_creation_duration_ms');
const successRate = new Rate('success_rate');
const failedRequests = new Counter('failed_requests');
const successfulRequests = new Counter('successful_requests');

// Configuration
const BASE_URL = __ENV.API_URL || 'http://localhost:3000';
const USER_ID = __ENV.USER_ID || '44a66a3e-5e9b-4fb0-8938-ba099ff638d1';

// Test configuration: 500 requests in 1 second
export const options = {
  scenarios: {
    burst_test: {
      executor: 'constant-arrival-rate',
      rate: 500,           // 500 requests
      timeUnit: '1s',      // per second
      duration: '1s',      // for 1 second
      preAllocatedVUs: 50, // Pre-allocate 50 VUs
      maxVUs: 500,         // Allow up to 500 VUs if needed
    },
  },
  thresholds: {
    'http_req_duration': ['p(50)<500', 'p(95)<2000', 'p(99)<5000'],
    'http_req_failed': ['rate<0.1'],
    'success_rate': ['rate>0.9'],
    'event_creation_duration_ms': ['p(95)<2000'],
  },
};

// Helper function to generate random event
function generateEvent(userId, index) {
  const now = new Date();
  const startTime = new Date(now.getTime() + Math.random() * 7 * 24 * 60 * 60 * 1000);
  const duration = [30, 60, 90, 120][Math.floor(Math.random() * 4)];
  const endTime = new Date(startTime.getTime() + duration * 60 * 1000);

  const meetingTypes = [
    'Team Meeting',
    'Client Call',
    'Project Review',
    '1-on-1',
    'Sprint Planning',
    'Code Review',
    'Design Discussion',
    'All Hands',
    'Training Session',
    'Brainstorming'
  ];

  const statuses = ['TODO', 'IN_PROGRESS', 'COMPLETED'];

  return {
    title: `${meetingTypes[Math.floor(Math.random() * meetingTypes.length)]} #${index}`,
    description: `Burst load test - VU: ${__VU}, Iteration: ${__ITER}`,
    status: statuses[Math.floor(Math.random() * statuses.length)],
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    inviteeIds: [userId]
  };
}

export default function () {
  const event = generateEvent(USER_ID, Date.now() + __VU);
  const payload = JSON.stringify(event);

  const startTime = Date.now();

  const res = http.post(`${BASE_URL}/events`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { name: 'BurstCreateEvent' },
  });

  const duration = Date.now() - startTime;
  eventCreationDuration.add(duration);

  const success = check(res, {
    'status is 201': (r) => r.status === 201,
    'has event id': (r) => {
      try {
        return JSON.parse(r.body).id !== undefined;
      } catch (e) {
        return false;
      }
    },
    'response time < 5s': (r) => r.timings.duration < 5000,
  });

  if (success) {
    successfulRequests.add(1);
    successRate.add(true);
  } else {
    failedRequests.add(1);
    successRate.add(false);
    console.error(`Request failed: VU=${__VU}, Status=${res.status}, Duration=${duration}ms`);
  }
}

// Setup function - runs once before test
export function setup() {
  console.log('========================================');
  console.log('Burst Load Test: 500 Requests in 1 Second');
  console.log('========================================');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`User ID: ${USER_ID}`);
  console.log('Target: 500 requests/second for 1 second');
  console.log('========================================\n');

  // Verify API is accessible
  const healthCheck = http.get(`${BASE_URL}/`);
  if (healthCheck.status !== 200) {
    throw new Error(`API health check failed with status ${healthCheck.status}`);
  }

  console.log('✓ API is healthy, starting burst test...\n');
  return { startTime: new Date() };
}

// Teardown function - runs once after test
export function teardown(data) {
  const endTime = new Date();
  const duration = (endTime - data.startTime) / 1000;

  console.log('\n========================================');
  console.log('Burst Test Completed');
  console.log('========================================');
  console.log(`Total Duration: ${duration.toFixed(2)} seconds`);
  console.log('Check metrics above for detailed results');
  console.log('========================================\n');
}
