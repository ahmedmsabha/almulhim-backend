import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const IDS = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  planId: '550e8400-e29b-41d4-a716-446655440001',
  subscriptionId: '550e8400-e29b-41d4-a716-446655440002',
  unitId: '550e8400-e29b-41d4-a716-446655440010',
  chapterId: '550e8400-e29b-41d4-a716-446655440011',
  lessonId: '550e8400-e29b-41d4-a716-446655440012',
  lessonVideoId: '550e8400-e29b-41d4-a716-446655440013',
  videoId: '550e8400-e29b-41d4-a716-446655440014',
  pdfId: '550e8400-e29b-41d4-a716-446655440015',
  announcementId: '550e8400-e29b-41d4-a716-446655440020',
  supportRequestId: '550e8400-e29b-41d4-a716-446655440030',
};

const mockResponse = (name, status, code, body) => ({
  name,
  originalRequest: { method: 'GET', header: [], url: '{{baseUrl}}/health' },
  status,
  code,
  _postman_previewlanguage: 'json',
  header: [{ key: 'Content-Type', value: 'application/json' }],
  cookie: [],
  body: JSON.stringify(body, null, 2),
});

const bearerAuth = (tokenVar = '{{bearerToken}}') => ({
  type: 'bearer',
  bearer: [{ key: 'token', value: tokenVar, type: 'string' }],
});

const jsonHeader = { key: 'Content-Type', value: 'application/json' };

const deviceHeaders = () => [
  { key: 'X-Device-Id', value: '{{deviceId}}' },
  { key: 'X-Device-Type', value: '{{deviceType}}' },
];

const req = ({
  name,
  method,
  path,
  auth = 'bearer',
  bearerVar,
  headers = [],
  body,
  description,
  examples = [],
  deviceBinding = false,
}) => {
  const requestHeaders = [...headers];
  if (body !== undefined) {
    if (!requestHeaders.some((h) => h.key === 'Content-Type')) {
      requestHeaders.push(jsonHeader);
    }
  }
  if (deviceBinding) {
    requestHeaders.push(...deviceHeaders());
  }

  const item = {
    name,
    request: {
      method,
      header: requestHeaders,
      url: `{{baseUrl}}${path}`,
      description,
    },
    response: examples.map((ex) =>
      mockResponse(ex.name ?? `${codeLabel(ex.code)} ${name}`, ex.status ?? 'OK', ex.code ?? 200, ex.body),
    ),
  };

  if (auth === 'bearer') {
    item.request.auth = bearerAuth(bearerVar);
  } else if (auth === 'admin') {
    item.request.auth = bearerAuth('{{adminBearerToken}}');
  } else if (auth === 'student') {
    item.request.auth = bearerAuth('{{studentBearerToken}}');
  } else if (auth === 'none') {
    item.request.auth = { type: 'noauth' };
  }

  if (body !== undefined) {
    item.request.body = {
      mode: 'raw',
      raw: typeof body === 'string' ? body : JSON.stringify(body, null, 2),
    };
  }

  return item;
};

const codeLabel = (code) => String(code);

const folder = (name, description, items) => ({
  name,
  description,
  item: items,
});

const collection = {
  info: {
    _postman_id: randomUUID(),
    name: 'Mulhim Backend',
    description:
      'Complete Mulhim learning platform backend API.\n\nAuth: Clerk bearer tokens. Set `studentBearerToken` or `adminBearerToken` in the Local environment.\n\nDevice-bound routes require `X-Device-Id` (16–128 chars) and `X-Device-Type` (`web` or `mobile`).',
    schema:
      'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  auth: bearerAuth('{{bearerToken}}'),
  variable: [
    { key: 'baseUrl', value: 'http://localhost:3000' },
    { key: 'bearerToken', value: '{{studentBearerToken}}' },
  ],
  item: [
    folder('Health', 'Public health check.', [
      req({
        name: 'Check Health',
        method: 'GET',
        path: '/health',
        auth: 'none',
        description: 'Public. No auth required.',
        examples: [
          {
            body: {
              status: 'ok',
              environment: 'development',
              database: 'up',
            },
          },
        ],
      }),
    ]),

    folder('Users', 'Registration and profile.', [
      req({
        name: 'Get Current User',
        method: 'GET',
        path: '/users/me',
        auth: 'student',
        description: 'Requires Clerk auth. Returns 404 if not registered.',
        examples: [
          {
            body: {
              id: IDS.userId,
              email: 'student@example.com',
              fullName: 'Ahmad Student',
              phoneNumber: '0599000000',
              telegramUsername: 'ahmad_tg',
              region: 'gaza',
              role: 'student',
              createdAt: '2026-01-15T10:00:00.000Z',
              updatedAt: '2026-01-15T10:00:00.000Z',
            },
          },
        ],
      }),
      req({
        name: 'Register User',
        method: 'POST',
        path: '/users/register',
        auth: 'student',
        description:
          'Requires Clerk auth and JWT `email` claim. Email comes from token, not body.',
        body: {
          fullName: 'Ahmad Student',
          phoneNumber: '0599000000',
          telegramUsername: 'ahmad_tg',
          region: 'gaza',
        },
        examples: [
          {
            body: {
              id: IDS.userId,
              email: 'student@example.com',
              fullName: 'Ahmad Student',
              phoneNumber: '0599000000',
              telegramUsername: 'ahmad_tg',
              region: 'gaza',
              role: 'student',
              createdAt: '2026-01-15T10:00:00.000Z',
              updatedAt: '2026-01-15T10:00:00.000Z',
            },
          },
        ],
      }),
      req({
        name: 'List Students (Admin)',
        method: 'GET',
        path: '/users?q=sara&region=gaza&status=active&page=1&pageSize=10',
        auth: 'admin',
        description:
          'Optional query: `q` (search name/email/phone/telegram), `region` (gaza|west_bank), `status` (free|pending_review|pending_approval|active|expired|rejected|suspended), `page` (default 1), `pageSize` (default 10, max 100). Response: `{ students, total, page, pageSize }`. Student rows use `phone` / `telegram` and `subscriptionStatus`.',
        examples: [
          {
            body: {
              students: [
                {
                  id: IDS.userId,
                  fullName: 'Ahmad Student',
                  email: 'student@example.com',
                  phone: '0599000000',
                  telegram: 'ahmad_tg',
                  region: 'gaza',
                  subscriptionStatus: 'active',
                },
              ],
              total: 1,
              page: 1,
              pageSize: 10,
            },
          },
        ],
      }),
      req({
        name: 'Get Student (Admin)',
        method: 'GET',
        path: '/users/{{userId}}',
        auth: 'admin',
        description:
          'Returns one student in the same list-row DTO (`phone`, `telegram`, `subscriptionStatus`). 404 if missing or not a student.',
        examples: [
          {
            body: {
              id: IDS.userId,
              fullName: 'Ahmad Student',
              email: 'student@example.com',
              phone: '0599000000',
              telegram: 'ahmad_tg',
              region: 'gaza',
              subscriptionStatus: 'active',
            },
          },
        ],
      }),
    ]),

    folder('Plans', 'Subscription plan catalog.', [
      req({
        name: 'List Public Plans',
        method: 'GET',
        path: '/plans/public',
        auth: 'none',
        examples: [
          {
            body: {
              plans: [{ name: 'Monthly', priceAmount: 5000, currency: 'ILS' }],
            },
          },
        ],
      }),
      req({
        name: 'List Active Plans',
        method: 'GET',
        path: '/plans',
        auth: 'student',
        examples: [
          {
            body: {
              plans: [
                {
                  id: IDS.planId,
                  name: 'Monthly',
                  description: '30-day access',
                  priceAmount: 5000,
                  currency: 'ILS',
                  durationDays: 30,
                  sortOrder: 0,
                },
              ],
            },
          },
        ],
      }),
      req({
        name: 'List All Plans (Admin)',
        method: 'GET',
        path: '/plans/all',
        auth: 'admin',
        examples: [
          {
            body: {
              plans: [
                {
                  id: IDS.planId,
                  name: 'Monthly',
                  description: '30-day access',
                  priceAmount: 5000,
                  currency: 'ILS',
                  durationDays: 30,
                  sortOrder: 0,
                  isActive: true,
                  createdAt: '2026-01-01T00:00:00.000Z',
                  updatedAt: '2026-01-01T00:00:00.000Z',
                },
              ],
            },
          },
        ],
      }),
      req({
        name: 'Create Plan (Admin)',
        method: 'POST',
        path: '/plans',
        auth: 'admin',
        body: {
          name: 'Monthly',
          description: '30-day access',
          priceAmount: 5000,
          currency: 'ILS',
          durationDays: 30,
          sortOrder: 0,
        },
        examples: [
          {
            code: 201,
            status: 'Created',
            body: {
              id: IDS.planId,
              name: 'Monthly',
              description: '30-day access',
              priceAmount: 5000,
              currency: 'ILS',
              durationDays: 30,
              sortOrder: 0,
              isActive: true,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-01T00:00:00.000Z',
            },
          },
        ],
      }),
      req({
        name: 'Update Plan (Admin)',
        method: 'PATCH',
        path: '/plans/{{planId}}',
        auth: 'admin',
        body: { isActive: false },
        examples: [
          {
            body: {
              id: IDS.planId,
              name: 'Monthly',
              description: '30-day access',
              priceAmount: 5000,
              currency: 'ILS',
              durationDays: 30,
              sortOrder: 0,
              isActive: false,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-02-01T00:00:00.000Z',
            },
          },
        ],
      }),
    ]),

    folder('Subscriptions', 'Student subscription and receipt flow.', [
      req({
        name: 'Create Receipt Upload URL',
        method: 'POST',
        path: '/subscriptions/receipt-upload-url',
        auth: 'student',
        body: { contentType: 'image/jpeg' },
        examples: [
          {
            body: {
              uploadUrl: 'https://r2.example.com/signed-put-url',
              receiptStorageKey: `receipts/${IDS.userId}/550e8400-e29b-41d4-a716-446655440099.jpg`,
              expiresInSeconds: 900,
            },
          },
        ],
      }),
      req({
        name: 'Submit Subscription',
        method: 'POST',
        path: '/subscriptions',
        auth: 'student',
        body: {
          planId: '{{planId}}',
          senderName: 'Ahmad Student',
          receiptStorageKey: 'receipts/{{userId}}/550e8400-e29b-41d4-a716-446655440099.jpg',
        },
        examples: [
          {
            code: 201,
            status: 'Created',
            body: {
              id: IDS.subscriptionId,
              status: 'pending_review',
              plan: {
                id: IDS.planId,
                name: 'Monthly',
                priceAmount: 5000,
                currency: 'ILS',
                durationDays: 30,
              },
              receiptSenderName: 'Ahmad Student',
              createdAt: '2026-02-01T12:00:00.000Z',
              updatedAt: '2026-02-01T12:00:00.000Z',
            },
          },
        ],
      }),
      req({
        name: 'Get My Subscription',
        method: 'GET',
        path: '/subscriptions/me',
        auth: 'student',
        examples: [
          {
            body: {
              id: IDS.subscriptionId,
              status: 'pending_approval',
              plan: {
                id: IDS.planId,
                name: 'Monthly',
                priceAmount: 5000,
                currency: 'ILS',
                durationDays: 30,
              },
              receiptSenderName: 'Ahmad Student',
              createdAt: '2026-02-01T12:00:00.000Z',
              updatedAt: '2026-02-01T12:30:00.000Z',
            },
          },
        ],
      }),
    ]),

    folder('Subscriptions Admin', 'Admin subscription review.', [
      req({
        name: 'List Pending Subscriptions',
        method: 'GET',
        path: '/subscriptions/pending',
        auth: 'admin',
        examples: [
          {
            body: {
              subscriptions: [
                {
                  id: IDS.subscriptionId,
                  status: 'pending_approval',
                  plan: {
                    id: IDS.planId,
                    name: 'Monthly',
                    priceAmount: 5000,
                    currency: 'ILS',
                    durationDays: 30,
                  },
                  student: {
                    id: IDS.userId,
                    fullName: 'Ahmad Student',
                    email: 'student@example.com',
                    phoneNumber: '0599000000',
                    region: 'gaza',
                  },
                  receiptSenderName: 'Ahmad Student',
                  verificationResult: {
                    version: 1,
                    passed: true,
                    verifiedAt: '2026-02-01T12:30:00.000Z',
                    aiEnabled: true,
                    model: 'gemini-3.5-flash',
                    error: null,
                    checks: {
                      recipientMatch: {
                        passed: true,
                        detected: 'Teacher Name',
                        reason: null,
                      },
                      senderMatch: {
                        passed: true,
                        detected: 'Ahmad Student',
                        expected: 'Ahmad Student',
                        reason: null,
                      },
                      notDuplicate: {
                        passed: true,
                        detected: 'TX-123',
                        transactionReference: 'TX-123',
                        reason: null,
                      },
                    },
                    notes: null,
                  },
                  verifiedAt: '2026-02-01T12:30:00.000Z',
                  approvedAt: null,
                  rejectedAt: null,
                  rejectionReason: null,
                  expiresAt: null,
                  suspendedAt: null,
                  createdAt: '2026-02-01T12:00:00.000Z',
                  updatedAt: '2026-02-01T12:30:00.000Z',
                },
              ],
            },
          },
        ],
      }),
      req({
        name: 'Get Subscription By Id',
        method: 'GET',
        path: '/subscriptions/{{subscriptionId}}',
        auth: 'admin',
        examples: [
          {
            body: {
              id: IDS.subscriptionId,
              status: 'pending_approval',
              plan: {
                id: IDS.planId,
                name: 'Monthly',
                priceAmount: 5000,
                currency: 'ILS',
                durationDays: 30,
              },
              student: {
                id: IDS.userId,
                fullName: 'Ahmad Student',
                email: 'student@example.com',
                phoneNumber: '0599000000',
                region: 'gaza',
              },
              receiptSenderName: 'Ahmad Student',
              verificationResult: {
                version: 1,
                passed: true,
                verifiedAt: '2026-02-01T12:30:00.000Z',
                aiEnabled: true,
                model: 'gemini-3.5-flash',
                error: null,
                checks: {
                  recipientMatch: {
                    passed: true,
                    detected: 'Teacher Name',
                    reason: null,
                  },
                  senderMatch: {
                    passed: true,
                    detected: 'Ahmad Student',
                    expected: 'Ahmad Student',
                    reason: null,
                  },
                  notDuplicate: {
                    passed: true,
                    detected: 'TX-123',
                    transactionReference: 'TX-123',
                    reason: null,
                  },
                },
                notes: null,
              },
              verifiedAt: '2026-02-01T12:30:00.000Z',
              approvedAt: null,
              rejectedAt: null,
              rejectionReason: null,
              expiresAt: null,
              suspendedAt: null,
              createdAt: '2026-02-01T12:00:00.000Z',
              updatedAt: '2026-02-01T12:30:00.000Z',
            },
          },
        ],
      }),
      req({
        name: 'Get Receipt URL',
        method: 'GET',
        path: '/subscriptions/{{subscriptionId}}/receipt-url',
        auth: 'admin',
        examples: [
          {
            body: {
              url: 'https://r2.example.com/signed-get-receipt',
              expiresInSeconds: 900,
            },
          },
        ],
      }),
      req({
        name: 'Approve Subscription',
        method: 'PATCH',
        path: '/subscriptions/{{subscriptionId}}/approve',
        auth: 'admin',
        examples: [
          {
            body: {
              id: IDS.subscriptionId,
              status: 'active',
              plan: {
                id: IDS.planId,
                name: 'Monthly',
                priceAmount: 5000,
                currency: 'ILS',
                durationDays: 30,
              },
              student: {
                id: IDS.userId,
                fullName: 'Ahmad Student',
                email: 'student@example.com',
                phoneNumber: '0599000000',
                region: 'gaza',
              },
              receiptSenderName: 'Ahmad Student',
              verificationResult: { passed: true },
              verifiedAt: '2026-02-01T12:30:00.000Z',
              approvedAt: '2026-02-01T13:00:00.000Z',
              rejectedAt: null,
              rejectionReason: null,
              expiresAt: '2026-03-03T13:00:00.000Z',
              suspendedAt: null,
              createdAt: '2026-02-01T12:00:00.000Z',
              updatedAt: '2026-02-01T13:00:00.000Z',
            },
          },
        ],
      }),
      req({
        name: 'Reject Subscription',
        method: 'PATCH',
        path: '/subscriptions/{{subscriptionId}}/reject',
        auth: 'admin',
        body: { rejectionReason: 'Receipt does not match sender name' },
        examples: [
          {
            body: {
              id: IDS.subscriptionId,
              status: 'rejected',
              plan: {
                id: IDS.planId,
                name: 'Monthly',
                priceAmount: 5000,
                currency: 'ILS',
                durationDays: 30,
              },
              student: {
                id: IDS.userId,
                fullName: 'Ahmad Student',
                email: 'student@example.com',
                phoneNumber: '0599000000',
                region: 'gaza',
              },
              receiptSenderName: 'Ahmad Student',
              verificationResult: { passed: false },
              verifiedAt: '2026-02-01T12:30:00.000Z',
              approvedAt: null,
              rejectedAt: '2026-02-01T13:00:00.000Z',
              rejectionReason: 'Receipt does not match sender name',
              expiresAt: null,
              suspendedAt: null,
              createdAt: '2026-02-01T12:00:00.000Z',
              updatedAt: '2026-02-01T13:00:00.000Z',
            },
          },
        ],
      }),
      req({
        name: 'Suspend Subscription',
        method: 'PATCH',
        path: '/subscriptions/{{subscriptionId}}/suspend',
        auth: 'admin',
        examples: [
          {
            body: {
              id: IDS.subscriptionId,
              status: 'suspended',
              plan: {
                id: IDS.planId,
                name: 'Monthly',
                priceAmount: 5000,
                currency: 'ILS',
                durationDays: 30,
              },
              student: {
                id: IDS.userId,
                fullName: 'Ahmad Student',
                email: 'student@example.com',
                phoneNumber: '0599000000',
                region: 'gaza',
              },
              receiptSenderName: 'Ahmad Student',
              verificationResult: { passed: true },
              verifiedAt: '2026-02-01T12:30:00.000Z',
              approvedAt: '2026-02-01T13:00:00.000Z',
              rejectedAt: null,
              rejectionReason: null,
              expiresAt: '2026-03-03T13:00:00.000Z',
              suspendedAt: '2026-02-15T09:00:00.000Z',
              createdAt: '2026-02-01T12:00:00.000Z',
              updatedAt: '2026-02-15T09:00:00.000Z',
            },
          },
        ],
      }),
    ]),

    folder('Content', 'Student content read APIs.', [
      req({
        name: 'Get Content Tree',
        method: 'GET',
        path: '/content/tree',
        auth: 'student',
        examples: [
          {
            body: {
              units: [
                {
                  id: IDS.unitId,
                  title: 'Unit 1',
                  description: 'Intro unit',
                  sortOrder: 0,
                  chapters: [
                    {
                      id: IDS.chapterId,
                      title: 'Chapter 1',
                      sortOrder: 0,
                      lessons: [
                        {
                          id: IDS.lessonId,
                          title: 'Lesson 1',
                          sortOrder: 0,
                          accessLevel: 'preview',
                          isLocked: false,
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          },
        ],
      }),
      req({
        name: 'List Units',
        method: 'GET',
        path: '/content/units',
        auth: 'student',
        examples: [
          {
            body: {
              units: [
                {
                  id: IDS.unitId,
                  title: 'Unit 1',
                  description: 'Intro unit',
                  sortOrder: 0,
                },
              ],
            },
          },
        ],
      }),
      req({
        name: 'Get Unit',
        method: 'GET',
        path: '/content/units/{{unitId}}',
        auth: 'student',
        examples: [
          {
            body: {
              id: IDS.unitId,
              title: 'Unit 1',
              description: 'Intro unit',
              sortOrder: 0,
              chapters: [{ id: IDS.chapterId, title: 'Chapter 1', sortOrder: 0 }],
            },
          },
        ],
      }),
      req({
        name: 'Get Chapter',
        method: 'GET',
        path: '/content/chapters/{{chapterId}}',
        auth: 'student',
        examples: [
          {
            body: {
              id: IDS.chapterId,
              title: 'Chapter 1',
              sortOrder: 0,
              unitId: IDS.unitId,
              lessons: [
                {
                  id: IDS.lessonId,
                  title: 'Lesson 1',
                  sortOrder: 0,
                  accessLevel: 'subscriber_only',
                  isLocked: true,
                },
              ],
            },
          },
        ],
      }),
      req({
        name: 'Get Lesson',
        method: 'GET',
        path: '/content/lessons/{{lessonId}}',
        auth: 'student',
        examples: [
          {
            body: {
              id: IDS.lessonId,
              title: 'Lesson 1',
              sortOrder: 0,
              accessLevel: 'preview',
              isLocked: false,
              chapterId: IDS.chapterId,
              videos: [
                {
                  id: IDS.lessonVideoId,
                  title: 'Intro Video',
                  durationSeconds: 600,
                  sortOrder: 0,
                },
              ],
              pdfs: [],
            },
          },
        ],
      }),
    ]),

    folder('Content Admin', 'Admin content management.', [
      req({
        name: 'Get Admin Tree',
        method: 'GET',
        path: '/content/admin/tree',
        auth: 'admin',
        examples: [{ body: { units: [] } }],
      }),
      req({
        name: 'Get Admin Unit',
        method: 'GET',
        path: '/content/admin/units/{{unitId}}',
        auth: 'admin',
        examples: [
          {
            body: {
              id: IDS.unitId,
              title: 'Unit 1',
              description: 'Intro unit',
              region: 'both',
              sortOrder: 0,
              isPublished: false,
              publishedAt: null,
              chapters: [],
            },
          },
        ],
      }),
      req({
        name: 'Get Admin Chapter',
        method: 'GET',
        path: '/content/admin/chapters/{{chapterId}}',
        auth: 'admin',
        examples: [
          {
            body: {
              id: IDS.chapterId,
              title: 'Chapter 1',
              sortOrder: 0,
              unitId: IDS.unitId,
              isPublished: false,
              publishedAt: null,
              lessons: [],
            },
          },
        ],
      }),
      req({
        name: 'Get Admin Lesson',
        method: 'GET',
        path: '/content/admin/lessons/{{lessonId}}',
        auth: 'admin',
        examples: [
          {
            body: {
              id: IDS.lessonId,
              title: 'Lesson 1',
              sortOrder: 0,
              accessLevel: 'subscriber_only',
              chapterId: IDS.chapterId,
              isPublished: false,
              publishedAt: null,
              videos: [],
              pdfs: [],
            },
          },
        ],
      }),
      req({
        name: 'Create Unit',
        method: 'POST',
        path: '/content/admin/units',
        auth: 'admin',
        body: {
          title: 'Unit 1',
          description: 'Intro unit',
          region: 'both',
          sortOrder: 0,
        },
        examples: [
          {
            code: 201,
            status: 'Created',
            body: {
              id: IDS.unitId,
              title: 'Unit 1',
              description: 'Intro unit',
              region: 'both',
              sortOrder: 0,
              isPublished: false,
              publishedAt: null,
            },
          },
        ],
      }),
      req({
        name: 'Update Unit',
        method: 'PATCH',
        path: '/content/admin/units/{{unitId}}',
        auth: 'admin',
        body: { title: 'Unit 1 Updated' },
        examples: [
          {
            body: {
              id: IDS.unitId,
              title: 'Unit 1 Updated',
              description: 'Intro unit',
              region: 'both',
              sortOrder: 0,
              isPublished: false,
              publishedAt: null,
            },
          },
        ],
      }),
      req({
        name: 'Publish Unit',
        method: 'PATCH',
        path: '/content/admin/units/{{unitId}}/publish',
        auth: 'admin',
        examples: [
          {
            body: {
              id: IDS.unitId,
              title: 'Unit 1',
              description: 'Intro unit',
              region: 'both',
              sortOrder: 0,
              isPublished: true,
              publishedAt: '2026-02-01T10:00:00.000Z',
            },
          },
        ],
      }),
      req({
        name: 'Unpublish Unit',
        method: 'PATCH',
        path: '/content/admin/units/{{unitId}}/unpublish',
        auth: 'admin',
        examples: [
          {
            body: {
              id: IDS.unitId,
              title: 'Unit 1',
              description: 'Intro unit',
              region: 'both',
              sortOrder: 0,
              isPublished: false,
              publishedAt: null,
            },
          },
        ],
      }),
      req({
        name: 'Create Chapter',
        method: 'POST',
        path: '/content/admin/units/{{unitId}}/chapters',
        auth: 'admin',
        body: { title: 'Chapter 1', sortOrder: 0 },
        examples: [
          {
            code: 201,
            status: 'Created',
            body: {
              id: IDS.chapterId,
              title: 'Chapter 1',
              sortOrder: 0,
              unitId: IDS.unitId,
              isPublished: false,
              publishedAt: null,
              lessons: [],
            },
          },
        ],
      }),
      req({
        name: 'Update Chapter',
        method: 'PATCH',
        path: '/content/admin/chapters/{{chapterId}}',
        auth: 'admin',
        body: { title: 'Chapter 1 Updated' },
        examples: [
          {
            body: {
              id: IDS.chapterId,
              title: 'Chapter 1 Updated',
              sortOrder: 0,
              unitId: IDS.unitId,
              isPublished: false,
              publishedAt: null,
              lessons: [],
            },
          },
        ],
      }),
      req({
        name: 'Publish Chapter',
        method: 'PATCH',
        path: '/content/admin/chapters/{{chapterId}}/publish',
        auth: 'admin',
        examples: [
          {
            body: {
              id: IDS.chapterId,
              title: 'Chapter 1',
              sortOrder: 0,
              unitId: IDS.unitId,
              isPublished: true,
              publishedAt: '2026-02-01T10:00:00.000Z',
              lessons: [],
            },
          },
        ],
      }),
      req({
        name: 'Unpublish Chapter',
        method: 'PATCH',
        path: '/content/admin/chapters/{{chapterId}}/unpublish',
        auth: 'admin',
        examples: [
          {
            body: {
              id: IDS.chapterId,
              title: 'Chapter 1',
              sortOrder: 0,
              unitId: IDS.unitId,
              isPublished: false,
              publishedAt: null,
              lessons: [],
            },
          },
        ],
      }),
      req({
        name: 'Create Lesson',
        method: 'POST',
        path: '/content/admin/chapters/{{chapterId}}/lessons',
        auth: 'admin',
        body: {
          title: 'Lesson 1',
          accessLevel: 'subscriber_only',
          sortOrder: 0,
        },
        examples: [
          {
            code: 201,
            status: 'Created',
            body: {
              id: IDS.lessonId,
              title: 'Lesson 1',
              sortOrder: 0,
              accessLevel: 'subscriber_only',
              chapterId: IDS.chapterId,
              isPublished: false,
              publishedAt: null,
              videos: [],
              pdfs: [],
            },
          },
        ],
      }),
      req({
        name: 'Update Lesson',
        method: 'PATCH',
        path: '/content/admin/lessons/{{lessonId}}',
        auth: 'admin',
        body: { title: 'Lesson 1 Updated' },
        examples: [
          {
            body: {
              id: IDS.lessonId,
              title: 'Lesson 1 Updated',
              sortOrder: 0,
              accessLevel: 'subscriber_only',
              chapterId: IDS.chapterId,
              isPublished: false,
              publishedAt: null,
              videos: [],
              pdfs: [],
            },
          },
        ],
      }),
      req({
        name: 'Publish Lesson',
        method: 'PATCH',
        path: '/content/admin/lessons/{{lessonId}}/publish',
        auth: 'admin',
        examples: [
          {
            body: {
              id: IDS.lessonId,
              title: 'Lesson 1',
              sortOrder: 0,
              accessLevel: 'subscriber_only',
              chapterId: IDS.chapterId,
              isPublished: true,
              publishedAt: '2026-02-01T10:00:00.000Z',
              videos: [],
              pdfs: [],
            },
          },
        ],
      }),
      req({
        name: 'Unpublish Lesson',
        method: 'PATCH',
        path: '/content/admin/lessons/{{lessonId}}/unpublish',
        auth: 'admin',
        examples: [
          {
            body: {
              id: IDS.lessonId,
              title: 'Lesson 1',
              sortOrder: 0,
              accessLevel: 'subscriber_only',
              chapterId: IDS.chapterId,
              isPublished: false,
              publishedAt: null,
              videos: [],
              pdfs: [],
            },
          },
        ],
      }),
      req({
        name: 'Create Video Upload URL',
        method: 'POST',
        path: '/content/admin/lessons/{{lessonId}}/videos/upload-url',
        auth: 'admin',
        body: { contentType: 'video/mp4' },
        examples: [
          {
            body: {
              uploadUrl: 'https://r2.example.com/signed-put-video',
              storageKey: `videos/${IDS.lessonId}/550e8400-e29b-41d4-a716-446655440099.mp4`,
              expiresInSeconds: 900,
            },
          },
        ],
      }),
      req({
        name: 'Attach Video',
        method: 'POST',
        path: '/content/admin/lessons/{{lessonId}}/videos',
        auth: 'admin',
        body: {
          storageKey: `videos/${IDS.lessonId}/550e8400-e29b-41d4-a716-446655440099.mp4`,
          title: 'Intro Video',
          sortOrder: 0,
          durationSeconds: 600,
        },
        examples: [
          {
            code: 201,
            status: 'Created',
            body: {
              id: IDS.videoId,
              lessonId: IDS.lessonId,
              title: 'Intro Video',
              storageKey: `videos/${IDS.lessonId}/550e8400-e29b-41d4-a716-446655440099.mp4`,
              durationSeconds: 600,
              sortOrder: 0,
            },
          },
        ],
      }),
      req({
        name: 'Update Video',
        method: 'PATCH',
        path: '/content/admin/videos/{{videoId}}',
        auth: 'admin',
        body: { title: 'Intro Video Updated' },
        examples: [
          {
            body: {
              id: IDS.videoId,
              lessonId: IDS.lessonId,
              title: 'Intro Video Updated',
              storageKey: `videos/${IDS.lessonId}/550e8400-e29b-41d4-a716-446655440099.mp4`,
              durationSeconds: 600,
              sortOrder: 0,
            },
          },
        ],
      }),
      req({
        name: 'Create PDF Upload URL',
        method: 'POST',
        path: '/content/admin/lessons/{{lessonId}}/pdfs/upload-url',
        auth: 'admin',
        body: { contentType: 'application/pdf' },
        examples: [
          {
            body: {
              uploadUrl: 'https://r2.example.com/signed-put-pdf',
              storageKey: `pdfs/${IDS.lessonId}/550e8400-e29b-41d4-a716-446655440099.pdf`,
              expiresInSeconds: 900,
            },
          },
        ],
      }),
      req({
        name: 'Attach PDF',
        method: 'POST',
        path: '/content/admin/lessons/{{lessonId}}/pdfs',
        auth: 'admin',
        body: {
          storageKey: `pdfs/${IDS.lessonId}/550e8400-e29b-41d4-a716-446655440099.pdf`,
          title: 'Lesson Notes',
          sortOrder: 0,
        },
        examples: [
          {
            code: 201,
            status: 'Created',
            body: {
              id: IDS.pdfId,
              lessonId: IDS.lessonId,
              title: 'Lesson Notes',
              storageKey: `pdfs/${IDS.lessonId}/550e8400-e29b-41d4-a716-446655440099.pdf`,
              sortOrder: 0,
            },
          },
        ],
      }),
      req({
        name: 'Update PDF',
        method: 'PATCH',
        path: '/content/admin/pdfs/{{pdfId}}',
        auth: 'admin',
        body: { title: 'Lesson Notes Updated' },
        examples: [
          {
            body: {
              id: IDS.pdfId,
              lessonId: IDS.lessonId,
              title: 'Lesson Notes Updated',
              storageKey: `pdfs/${IDS.lessonId}/550e8400-e29b-41d4-a716-446655440099.pdf`,
              sortOrder: 0,
            },
          },
        ],
      }),
    ]),

    folder('Announcements', 'Student announcement feed.', [
      req({
        name: 'List Announcements',
        method: 'GET',
        path: '/announcements',
        auth: 'student',
        examples: [
          {
            body: {
              announcements: [
                {
                  id: IDS.announcementId,
                  title: 'Welcome',
                  body: 'Platform is live.',
                  region: 'both',
                  publishedAt: '2026-02-01T08:00:00.000Z',
                  imageUrl: 'https://r2.example.com/signed-announcement-image',
                },
              ],
            },
          },
        ],
      }),
    ]),

    folder('Announcements Admin', 'Admin announcement management.', [
      req({
        name: 'List All Announcements',
        method: 'GET',
        path: '/announcements/admin',
        auth: 'admin',
        examples: [{ body: { announcements: [] } }],
      }),
      req({
        name: 'Get Announcement',
        method: 'GET',
        path: '/announcements/admin/{{announcementId}}',
        auth: 'admin',
        examples: [
          {
            body: {
              id: IDS.announcementId,
              title: 'Welcome',
              body: 'Platform is live.',
              region: 'both',
              imageStorageKey: null,
              isPublished: false,
              publishedAt: null,
              createdAt: '2026-02-01T08:00:00.000Z',
              updatedAt: '2026-02-01T08:00:00.000Z',
            },
          },
        ],
      }),
      req({
        name: 'Create Announcement',
        method: 'POST',
        path: '/announcements/admin',
        auth: 'admin',
        body: {
          title: 'Welcome',
          body: 'Platform is live.',
          region: 'both',
        },
        examples: [
          {
            code: 201,
            status: 'Created',
            body: {
              id: IDS.announcementId,
              title: 'Welcome',
              body: 'Platform is live.',
              region: 'both',
              imageStorageKey: null,
              isPublished: false,
              publishedAt: null,
              createdAt: '2026-02-01T08:00:00.000Z',
              updatedAt: '2026-02-01T08:00:00.000Z',
            },
          },
        ],
      }),
      req({
        name: 'Update Announcement',
        method: 'PATCH',
        path: '/announcements/admin/{{announcementId}}',
        auth: 'admin',
        body: { title: 'Welcome Updated' },
        examples: [
          {
            body: {
              id: IDS.announcementId,
              title: 'Welcome Updated',
              body: 'Platform is live.',
              region: 'both',
              imageStorageKey: null,
              isPublished: false,
              publishedAt: null,
              createdAt: '2026-02-01T08:00:00.000Z',
              updatedAt: '2026-02-01T09:00:00.000Z',
            },
          },
        ],
      }),
      req({
        name: 'Publish Announcement',
        method: 'PATCH',
        path: '/announcements/admin/{{announcementId}}/publish',
        auth: 'admin',
        examples: [
          {
            body: {
              id: IDS.announcementId,
              title: 'Welcome',
              body: 'Platform is live.',
              region: 'both',
              imageStorageKey: null,
              isPublished: true,
              publishedAt: '2026-02-01T10:00:00.000Z',
              createdAt: '2026-02-01T08:00:00.000Z',
              updatedAt: '2026-02-01T10:00:00.000Z',
            },
          },
        ],
      }),
      req({
        name: 'Unpublish Announcement',
        method: 'PATCH',
        path: '/announcements/admin/{{announcementId}}/unpublish',
        auth: 'admin',
        examples: [
          {
            body: {
              id: IDS.announcementId,
              title: 'Welcome',
              body: 'Platform is live.',
              region: 'both',
              imageStorageKey: null,
              isPublished: false,
              publishedAt: null,
              createdAt: '2026-02-01T08:00:00.000Z',
              updatedAt: '2026-02-01T11:00:00.000Z',
            },
          },
        ],
      }),
      req({
        name: 'Create Image Upload URL',
        method: 'POST',
        path: '/announcements/admin/{{announcementId}}/image-upload-url',
        auth: 'admin',
        body: { contentType: 'image/jpeg' },
        examples: [
          {
            body: {
              uploadUrl: 'https://r2.example.com/signed-put-image',
              storageKey: `announcements/${IDS.announcementId}/550e8400-e29b-41d4-a716-446655440099.jpg`,
              expiresInSeconds: 900,
            },
          },
        ],
      }),
      req({
        name: 'Attach Image',
        method: 'PATCH',
        path: '/announcements/admin/{{announcementId}}/attach-image',
        auth: 'admin',
        body: {
          storageKey: `announcements/${IDS.announcementId}/550e8400-e29b-41d4-a716-446655440099.jpg`,
        },
        examples: [
          {
            body: {
              id: IDS.announcementId,
              title: 'Welcome',
              body: 'Platform is live.',
              region: 'both',
              imageStorageKey: `announcements/${IDS.announcementId}/550e8400-e29b-41d4-a716-446655440099.jpg`,
              isPublished: false,
              publishedAt: null,
              createdAt: '2026-02-01T08:00:00.000Z',
              updatedAt: '2026-02-01T09:30:00.000Z',
            },
          },
        ],
      }),
    ]),

    folder('Support', 'Student support requests.', [
      req({
        name: 'Create Support Request',
        method: 'POST',
        path: '/support',
        auth: 'student',
        body: {
          subject: 'Payment question',
          message: 'I submitted a receipt but status is still pending.',
        },
        examples: [
          {
            code: 201,
            status: 'Created',
            body: {
              id: IDS.supportRequestId,
              subject: 'Payment question',
              message: 'I submitted a receipt but status is still pending.',
              status: 'open',
              adminReply: null,
              reviewedAt: null,
              closedAt: null,
              createdAt: '2026-02-01T14:00:00.000Z',
            },
          },
        ],
      }),
      req({
        name: 'List My Support Requests',
        method: 'GET',
        path: '/support/me',
        auth: 'student',
        examples: [
          {
            body: {
              requests: [
                {
                  id: IDS.supportRequestId,
                  subject: 'Payment question',
                  message: 'I submitted a receipt but status is still pending.',
                  status: 'open',
                  adminReply: null,
                  reviewedAt: null,
                  closedAt: null,
                  createdAt: '2026-02-01T14:00:00.000Z',
                },
              ],
            },
          },
        ],
      }),
    ]),

    folder('Support Admin', 'Admin support review.', [
      req({
        name: 'List Support Requests',
        method: 'GET',
        path: '/support/admin/requests?status=open',
        auth: 'admin',
        examples: [{ body: { requests: [] } }],
      }),
      req({
        name: 'Get Support Request',
        method: 'GET',
        path: '/support/admin/requests/{{supportRequestId}}',
        auth: 'admin',
        examples: [
          {
            body: {
              id: IDS.supportRequestId,
              subject: 'Payment question',
              message: 'I submitted a receipt but status is still pending.',
              status: 'open',
              adminReply: null,
              reviewedAt: null,
              closedAt: null,
              createdAt: '2026-02-01T14:00:00.000Z',
              student: {
                id: IDS.userId,
                fullName: 'Ahmad Student',
                email: 'student@example.com',
                phoneNumber: '0599000000',
                region: 'gaza',
              },
            },
          },
        ],
      }),
      req({
        name: 'Reply to Support Request',
        method: 'PATCH',
        path: '/support/admin/requests/{{supportRequestId}}/reply',
        auth: 'admin',
        body: { reply: 'We are reviewing your receipt now.' },
        examples: [
          {
            body: {
              id: IDS.supportRequestId,
              subject: 'Payment question',
              message: 'I submitted a receipt but status is still pending.',
              status: 'reviewed',
              adminReply: 'We are reviewing your receipt now.',
              reviewedAt: '2026-02-01T15:00:00.000Z',
              closedAt: null,
              createdAt: '2026-02-01T14:00:00.000Z',
              student: {
                id: IDS.userId,
                fullName: 'Ahmad Student',
                email: 'student@example.com',
                phoneNumber: '0599000000',
                region: 'gaza',
              },
            },
          },
        ],
      }),
      req({
        name: 'Close Support Request',
        method: 'PATCH',
        path: '/support/admin/requests/{{supportRequestId}}/close',
        auth: 'admin',
        examples: [
          {
            body: {
              id: IDS.supportRequestId,
              subject: 'Payment question',
              message: 'I submitted a receipt but status is still pending.',
              status: 'closed',
              adminReply: 'We are reviewing your receipt now.',
              reviewedAt: '2026-02-01T15:00:00.000Z',
              closedAt: '2026-02-01T16:00:00.000Z',
              createdAt: '2026-02-01T14:00:00.000Z',
              student: {
                id: IDS.userId,
                fullName: 'Ahmad Student',
                email: 'student@example.com',
                phoneNumber: '0599000000',
                region: 'gaza',
              },
            },
          },
        ],
      }),
    ]),

    folder('Devices', 'Student device binding.', [
      req({
        name: 'Bind Device',
        method: 'POST',
        path: '/devices/bind',
        auth: 'student',
        body: {
          deviceType: 'mobile',
          deviceIdentifier: '{{deviceId}}',
        },
        examples: [
          {
            code: 201,
            status: 'Created',
            body: {
              deviceType: 'mobile',
              boundAt: '2026-02-01T10:00:00.000Z',
              lastSeenAt: '2026-02-01T10:00:00.000Z',
            },
          },
        ],
      }),
      req({
        name: 'Get Device Status',
        method: 'GET',
        path: '/devices/me',
        auth: 'student',
        examples: [
          {
            body: {
              web: { bound: false, boundAt: null, lastSeenAt: null },
              mobile: {
                bound: true,
                boundAt: '2026-02-01T10:00:00.000Z',
                lastSeenAt: '2026-02-01T12:00:00.000Z',
              },
            },
          },
        ],
      }),
      req({
        name: 'Device Heartbeat',
        method: 'POST',
        path: '/devices/heartbeat',
        auth: 'student',
        deviceBinding: true,
        examples: [
          {
            body: {
              deviceType: 'mobile',
              lastSeenAt: '2026-02-01T12:30:00.000Z',
            },
          },
        ],
      }),
    ]),

    folder('Devices Admin', 'Admin device reset.', [
      req({
        name: 'List User Device Bindings',
        method: 'GET',
        path: '/devices/admin/users/{{userId}}/bindings',
        auth: 'admin',
        examples: [
          {
            body: {
              userId: IDS.userId,
              bindings: [
                {
                  deviceType: 'mobile',
                  boundAt: '2026-02-01T10:00:00.000Z',
                  lastSeenAt: '2026-02-01T12:00:00.000Z',
                },
              ],
            },
          },
        ],
      }),
      req({
        name: 'Reset Device Binding',
        method: 'DELETE',
        path: '/devices/admin/users/{{userId}}/bindings/mobile',
        auth: 'admin',
        examples: [
          {
            body: {
              userId: IDS.userId,
              bindings: [],
            },
          },
        ],
      }),
      req({
        name: 'Reset All Device Bindings',
        method: 'DELETE',
        path: '/devices/admin/users/{{userId}}/bindings',
        auth: 'admin',
        examples: [
          {
            body: {
              userId: IDS.userId,
              bindings: [],
            },
          },
        ],
      }),
    ]),

    folder('Downloads', 'Mobile secure video downloads.', [
      req({
        name: 'Authorize Video Download',
        method: 'POST',
        path: '/downloads/videos/{{lessonVideoId}}/authorize',
        auth: 'student',
        deviceBinding: true,
        description: 'Mobile device only. Requires active subscription for locked lessons.',
        examples: [
          {
            body: {
              downloadId: '550e8400-e29b-41d4-a716-446655440040',
              url: 'https://r2.example.com/signed-video-download',
              expiresAt: '2026-02-01T12:15:00.000Z',
            },
          },
        ],
      }),
      req({
        name: 'List My Downloads',
        method: 'GET',
        path: '/downloads/me',
        auth: 'student',
        deviceBinding: true,
        examples: [
          {
            body: {
              downloads: [
                {
                  id: '550e8400-e29b-41d4-a716-446655440040',
                  lessonVideoId: IDS.lessonVideoId,
                  downloadedAt: '2026-02-01T12:00:00.000Z',
                  revokedAt: null,
                  isRevoked: false,
                  isAccessValid: true,
                },
              ],
            },
          },
        ],
      }),
    ]),
  ],
};

const environment = {
  id: randomUUID(),
  name: 'Mulhim Backend Local',
  values: [
    { key: 'baseUrl', value: 'http://localhost:3000', type: 'default', enabled: true },
    {
      key: 'bearerToken',
      value: '',
      type: 'secret',
      enabled: true,
    },
    {
      key: 'studentBearerToken',
      value: '',
      type: 'secret',
      enabled: true,
    },
    {
      key: 'adminBearerToken',
      value: '',
      type: 'secret',
      enabled: true,
    },
    {
      key: 'deviceId',
      value: 'mock-mobile-device-id-01',
      type: 'default',
      enabled: true,
    },
    {
      key: 'deviceType',
      value: 'mobile',
      type: 'default',
      enabled: true,
    },
    { key: 'userId', value: IDS.userId, type: 'default', enabled: true },
    { key: 'planId', value: IDS.planId, type: 'default', enabled: true },
    {
      key: 'subscriptionId',
      value: IDS.subscriptionId,
      type: 'default',
      enabled: true,
    },
    { key: 'unitId', value: IDS.unitId, type: 'default', enabled: true },
    { key: 'chapterId', value: IDS.chapterId, type: 'default', enabled: true },
    { key: 'lessonId', value: IDS.lessonId, type: 'default', enabled: true },
    {
      key: 'lessonVideoId',
      value: IDS.lessonVideoId,
      type: 'default',
      enabled: true,
    },
    { key: 'videoId', value: IDS.videoId, type: 'default', enabled: true },
    { key: 'pdfId', value: IDS.pdfId, type: 'default', enabled: true },
    {
      key: 'announcementId',
      value: IDS.announcementId,
      type: 'default',
      enabled: true,
    },
    {
      key: 'supportRequestId',
      value: IDS.supportRequestId,
      type: 'default',
      enabled: true,
    },
  ],
  _postman_variable_scope: 'environment',
};

const collectionPath = join(__dirname, 'Mulhim Backend.postman_collection.json');
const environmentPath = join(
  __dirname,
  'Mulhim Backend Local.postman_environment.json',
);

writeFileSync(collectionPath, `${JSON.stringify(collection, null, 2)}\n`);
writeFileSync(environmentPath, `${JSON.stringify(environment, null, 2)}\n`);

const countRequests = (items) =>
  items.reduce(
    (total, item) => total + (item.item ? countRequests(item.item) : 1),
    0,
  );

console.log(`Wrote ${collectionPath}`);
console.log(`Wrote ${environmentPath}`);
console.log(`Folders: ${collection.item.length}`);
console.log(`Requests: ${countRequests(collection.item)}`);
