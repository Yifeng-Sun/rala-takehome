import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { EventStatus } from '../src/entities/event.entity';

describe('Events E2E Tests', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let testUserId: string;
  let createdEventId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Create a test user
    const userResult = await dataSource.query(
      `INSERT INTO users (name, email) VALUES ($1, $2) RETURNING id`,
      ['E2E Test User', 'e2e@example.com'],
    );
    testUserId = userResult[0].id;
  });

  afterAll(async () => {
    // Clean up test data
    await dataSource.query(`DELETE FROM event_invitees WHERE user_id = $1`, [
      testUserId,
    ]);
    await dataSource.query(`DELETE FROM events WHERE id = $1`, [
      createdEventId,
    ]);
    await dataSource.query(`DELETE FROM users WHERE id = $1`, [testUserId]);
    await app.close();
  });

  describe('POST /events', () => {
    it('should create a new event', () => {
      const createEventDto = {
        title: 'E2E Test Event',
        description: 'This is an E2E test event',
        status: EventStatus.TODO,
        startTime: '2025-01-15T10:00:00Z',
        endTime: '2025-01-15T11:00:00Z',
        inviteeIds: [testUserId],
      };

      return request(app.getHttpServer())
        .post('/events')
        .send(createEventDto)
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.title).toBe(createEventDto.title);
          expect(res.body.description).toBe(createEventDto.description);
          expect(res.body.status).toBe(createEventDto.status);
          expect(res.body.invitees).toHaveLength(1);
          createdEventId = res.body.id;
        });
    });

    it('should return 400 for invalid event data', () => {
      const invalidDto = {
        title: '',
        status: 'INVALID_STATUS',
        startTime: 'invalid-date',
        endTime: '2025-01-15T11:00:00Z',
      };

      return request(app.getHttpServer())
        .post('/events')
        .send(invalidDto)
        .expect(400);
    });

    it('should return 400 for non-existent invitee', () => {
      const createEventDto = {
        title: 'Test Event',
        description: 'Description',
        status: EventStatus.TODO,
        startTime: '2025-01-15T10:00:00Z',
        endTime: '2025-01-15T11:00:00Z',
        inviteeIds: ['00000000-0000-0000-0000-000000000000'],
      };

      return request(app.getHttpServer())
        .post('/events')
        .send(createEventDto)
        .expect(400);
    });
  });

  describe('GET /events/:id', () => {
    it('should retrieve an event by id', () => {
      return request(app.getHttpServer())
        .get(`/events/${createdEventId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('id', createdEventId);
          expect(res.body).toHaveProperty('title');
          expect(res.body).toHaveProperty('invitees');
        });
    });

    it('should return 404 for non-existent event', () => {
      return request(app.getHttpServer())
        .get('/events/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });

    it('should return 400 for invalid UUID format', () => {
      return request(app.getHttpServer())
        .get('/events/invalid-uuid')
        .expect(400);
    });
  });

  describe('GET /events/user/:userId', () => {
    it('should retrieve all events for a user', () => {
      return request(app.getHttpServer())
        .get(`/events/user/${testUserId}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0]).toHaveProperty('invitees');
        });
    });

    it('should return 404 for non-existent user', () => {
      return request(app.getHttpServer())
        .get('/events/user/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('PATCH /events/:id', () => {
    it('should update an event', () => {
      const updateDto = {
        title: 'Updated E2E Test Event',
        status: EventStatus.IN_PROGRESS,
      };

      return request(app.getHttpServer())
        .patch(`/events/${createdEventId}`)
        .send(updateDto)
        .expect(200)
        .expect((res) => {
          expect(res.body.title).toBe(updateDto.title);
          expect(res.body.status).toBe(updateDto.status);
        });
    });

    it('should return 404 for non-existent event', () => {
      return request(app.getHttpServer())
        .patch('/events/00000000-0000-0000-0000-000000000000')
        .send({ title: 'Updated' })
        .expect(404);
    });
  });

  describe('POST /events/batch', () => {
    let batchEventIds: string[] = [];

    afterEach(async () => {
      // Clean up batch events
      for (const id of batchEventIds) {
        await dataSource.query(
          `DELETE FROM event_invitees WHERE event_id = $1`,
          [id],
        );
        await dataSource.query(`DELETE FROM events WHERE id = $1`, [id]);
      }
      batchEventIds = [];
    });

    it('should create multiple events in batch', () => {
      const batchDto = {
        events: [
          {
            title: 'Batch Event 1',
            description: 'Description 1',
            status: EventStatus.TODO,
            startTime: '2025-01-15T10:00:00Z',
            endTime: '2025-01-15T11:00:00Z',
            inviteeIds: [testUserId],
          },
          {
            title: 'Batch Event 2',
            description: 'Description 2',
            status: EventStatus.TODO,
            startTime: '2025-01-15T12:00:00Z',
            endTime: '2025-01-15T13:00:00Z',
            inviteeIds: [testUserId],
          },
        ],
      };

      return request(app.getHttpServer())
        .post('/events/batch')
        .send(batchDto)
        .expect(201)
        .expect((res) => {
          expect(res.body.count).toBe(2);
          expect(res.body.events).toHaveLength(2);
          expect(res.body.events[0]).toHaveProperty('id');
          expect(res.body.events[1]).toHaveProperty('id');
          batchEventIds = res.body.events.map((e: any) => e.id);
        });
    });

    it('should return 400 for invalid batch data', () => {
      const invalidDto = {
        events: [
          {
            title: '',
            status: 'INVALID',
          },
        ],
      };

      return request(app.getHttpServer())
        .post('/events/batch')
        .send(invalidDto)
        .expect(400);
    });

    it('should reject batch with more than 500 events', () => {
      const events = Array(501).fill({
        title: 'Event',
        description: 'Description',
        status: EventStatus.TODO,
        startTime: '2025-01-15T10:00:00Z',
        endTime: '2025-01-15T11:00:00Z',
      });

      return request(app.getHttpServer())
        .post('/events/batch')
        .send({ events })
        .expect(400);
    });
  });

  describe('GET /events/conflicts/:userId', () => {
    let conflictEventIds: string[] = [];

    beforeEach(async () => {
      // Create overlapping events
      const event1Result = await dataSource.query(
        `INSERT INTO events (title, description, status, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          'Conflict Event 1',
          'Description',
          EventStatus.TODO,
          '2025-02-01T10:00:00Z',
          '2025-02-01T11:00:00Z',
        ],
      );
      const event1Id = event1Result[0].id;
      conflictEventIds.push(event1Id);

      const event2Result = await dataSource.query(
        `INSERT INTO events (title, description, status, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          'Conflict Event 2',
          'Description',
          EventStatus.TODO,
          '2025-02-01T10:30:00Z',
          '2025-02-01T11:30:00Z',
        ],
      );
      const event2Id = event2Result[0].id;
      conflictEventIds.push(event2Id);

      // Associate with test user
      await dataSource.query(
        `INSERT INTO event_invitees (event_id, user_id) VALUES ($1, $2)`,
        [event1Id, testUserId],
      );
      await dataSource.query(
        `INSERT INTO event_invitees (event_id, user_id) VALUES ($1, $2)`,
        [event2Id, testUserId],
      );
    });

    afterEach(async () => {
      // Clean up conflict events
      for (const id of conflictEventIds) {
        await dataSource.query(
          `DELETE FROM event_invitees WHERE event_id = $1`,
          [id],
        );
        await dataSource.query(`DELETE FROM events WHERE id = $1`, [id]);
      }
      conflictEventIds = [];
    });

    it('should detect overlapping events', () => {
      return request(app.getHttpServer())
        .get(`/events/conflicts/${testUserId}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
          expect(res.body[0]).toHaveLength(2);
        });
    });
  });

  describe('POST /events/merge-all/:userId', () => {
    let mergeEventIds: string[] = [];
    let mergedEventId: string;

    beforeEach(async () => {
      // Create overlapping events for merging
      const event1Result = await dataSource.query(
        `INSERT INTO events (title, description, status, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          'Merge Event 1',
          'Description 1',
          EventStatus.TODO,
          '2025-03-01T10:00:00Z',
          '2025-03-01T11:00:00Z',
        ],
      );
      const event1Id = event1Result[0].id;
      mergeEventIds.push(event1Id);

      const event2Result = await dataSource.query(
        `INSERT INTO events (title, description, status, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          'Merge Event 2',
          'Description 2',
          EventStatus.TODO,
          '2025-03-01T10:30:00Z',
          '2025-03-01T11:30:00Z',
        ],
      );
      const event2Id = event2Result[0].id;
      mergeEventIds.push(event2Id);

      // Associate with test user
      await dataSource.query(
        `INSERT INTO event_invitees (event_id, user_id) VALUES ($1, $2)`,
        [event1Id, testUserId],
      );
      await dataSource.query(
        `INSERT INTO event_invitees (event_id, user_id) VALUES ($1, $2)`,
        [event2Id, testUserId],
      );
    });

    afterEach(async () => {
      // Clean up merged event
      if (mergedEventId) {
        await dataSource.query(
          `DELETE FROM event_invitees WHERE event_id = $1`,
          [mergedEventId],
        );
        await dataSource.query(`DELETE FROM events WHERE id = $1`, [
          mergedEventId,
        ]);
      }
      mergedEventId = null;
    });

    it('should merge overlapping events', async () => {
      const response = await request(app.getHttpServer())
        .post(`/events/merge-all/${testUserId}`)
        .expect(200);

      expect(response.body.count).toBe(1);
      expect(response.body.events).toHaveLength(1);
      expect(response.body.events[0]).toHaveProperty('mergedFrom');
      expect(response.body.events[0].mergedFrom).toHaveLength(2);
      mergedEventId = response.body.events[0].id;

      // Wait a bit for Kafka processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify the merged event has an AI summary
      const eventResponse = await request(app.getHttpServer())
        .get(`/events/${mergedEventId}`)
        .expect(200);

      expect(eventResponse.body).toHaveProperty('aiSummary');
    });

    it('should return empty array if no conflicts', async () => {
      // First merge to remove conflicts
      await request(app.getHttpServer())
        .post(`/events/merge-all/${testUserId}`)
        .expect(200);

      // Try to merge again (no conflicts left)
      const response = await request(app.getHttpServer())
        .post(`/events/merge-all/${testUserId}`)
        .expect(200);

      expect(response.body.count).toBe(0);
      expect(response.body.events).toHaveLength(0);
    });
  });

  describe('DELETE /events/:id', () => {
    it('should delete an event', async () => {
      // Create a temporary event to delete
      const eventResult = await dataSource.query(
        `INSERT INTO events (title, description, status, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [
          'Event to Delete',
          'Description',
          EventStatus.TODO,
          '2025-04-01T10:00:00Z',
          '2025-04-01T11:00:00Z',
        ],
      );
      const eventId = eventResult[0].id;

      await dataSource.query(
        `INSERT INTO event_invitees (event_id, user_id) VALUES ($1, $2)`,
        [eventId, testUserId],
      );

      await request(app.getHttpServer())
        .delete(`/events/${eventId}`)
        .expect(200);

      // Verify deletion
      return request(app.getHttpServer())
        .get(`/events/${eventId}`)
        .expect(404);
    });

    it('should return 404 when deleting non-existent event', () => {
      return request(app.getHttpServer())
        .delete('/events/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });
});
