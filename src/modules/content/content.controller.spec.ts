jest.mock('./content.service', () => ({
  ContentService: class MockContentService {
    search = jest.fn();
    getTree = jest.fn();
  },
}));

jest.mock('../auth/auth.service', () => ({
  AuthService: class MockAuthService {
    findUserByClerkId = jest.fn();
  },
}));

import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ZodError } from 'zod';
import {
  REQUIRES_REGISTRATION_KEY,
  STUDENT_ONLY_KEY,
} from '../../common/constants/auth-metadata';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request.type';
import type { AuthService } from '../auth/auth.service';
import { RegisteredUserGuard } from '../auth/guards/registered-user.guard';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

describe('ContentController', () => {
  let contentController: ContentController;
  let contentService: jest.Mocked<Pick<ContentService, 'search'>>;

  const studentUser = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    clerkId: 'user_student',
    email: 'student@example.com',
    fullName: 'Student',
    phoneNumber: '0599000001',
    telegramUsername: 'student_tg',
    region: 'gaza' as const,
    role: 'student' as const,
    deactivatedAt: null as Date | null,
    createdAt: new Date('2026-07-01T08:00:00.000Z'),
    updatedAt: new Date('2026-07-01T08:00:00.000Z'),
  };

  const adminUser = {
    ...studentUser,
    id: '550e8400-e29b-41d4-a716-446655440002',
    clerkId: 'user_admin',
    email: 'admin@example.com',
    role: 'admin' as const,
  };

  beforeEach(() => {
    contentService = {
      search: jest.fn(),
    };
    contentController = new ContentController(
      contentService as unknown as ContentService,
    );
  });

  describe('POST /content/search auth metadata', () => {
    it('requires registration but is not student-only (admins allowed)', () => {
      const reflector = new Reflector();

      expect(
        reflector.getAllAndOverride<boolean>(REQUIRES_REGISTRATION_KEY, [
          contentController.search,
          ContentController,
        ]),
      ).toBe(true);

      expect(
        reflector.getAllAndOverride<boolean>(STUDENT_ONLY_KEY, [
          contentController.search,
          ContentController,
        ]),
      ).toBe(false);

      expect(
        reflector.getAllAndOverride<boolean>(STUDENT_ONLY_KEY, [
          contentController.getTree,
          ContentController,
        ]),
      ).toBe(true);
    });
  });

  describe('POST /content/search RegisteredUserGuard', () => {
    let guard: RegisteredUserGuard;
    let authService: jest.Mocked<Pick<AuthService, 'findUserByClerkId'>>;

    const createContext = (request: Partial<AuthenticatedRequest>) =>
      ({
        switchToHttp: () => ({
          getRequest: () => request,
        }),
        getHandler: () => contentController.search,
        getClass: () => ContentController,
      }) as never;

    beforeEach(() => {
      authService = { findUserByClerkId: jest.fn() };
      guard = new RegisteredUserGuard(
        new Reflector(),
        authService as unknown as AuthService,
      );
    });

    it('allows a registered student', async () => {
      authService.findUserByClerkId.mockResolvedValue(studentUser);
      const request = { clerkUserId: studentUser.clerkId } as AuthenticatedRequest;

      await expect(guard.canActivate(createContext(request))).resolves.toBe(
        true,
      );
      expect(request.user).toEqual(studentUser);
    });

    it('allows a registered admin', async () => {
      authService.findUserByClerkId.mockResolvedValue(adminUser);
      const request = { clerkUserId: adminUser.clerkId } as AuthenticatedRequest;

      await expect(guard.canActivate(createContext(request))).resolves.toBe(
        true,
      );
      expect(request.user).toEqual(adminUser);
    });

    it('rejects unauthenticated requests with 401', async () => {
      await expect(guard.canActivate(createContext({}))).rejects.toThrow(
        new UnauthorizedException('Authentication required'),
      );
    });

    it('rejects unregistered users like other registration-required routes', async () => {
      authService.findUserByClerkId.mockResolvedValue(null);

      await expect(
        guard.canActivate(
          createContext({ clerkUserId: 'user_unknown' } as AuthenticatedRequest),
        ),
      ).rejects.toThrow(new NotFoundException('User is not registered'));
    });

    it('still rejects admins on student-only tree routes', async () => {
      authService.findUserByClerkId.mockResolvedValue(adminUser);

      await expect(
        guard.canActivate({
          switchToHttp: () => ({
            getRequest: () =>
              ({ clerkUserId: adminUser.clerkId }) as AuthenticatedRequest,
          }),
          getHandler: () => contentController.getTree,
          getClass: () => ContentController,
        } as never),
      ).rejects.toThrow(new ForbiddenException('Student account required'));
    });
  });

  describe('search', () => {
    it('delegates to ContentService.search', async () => {
      contentService.search.mockResolvedValue({
        matchingIds: ['550e8400-e29b-41d4-a716-446655440010'],
      });

      await expect(
        contentController.search({
          query: 'unit',
          items: [],
        }),
      ).resolves.toEqual({
        matchingIds: ['550e8400-e29b-41d4-a716-446655440010'],
      });
    });

    it('maps Zod validation errors to BadRequestException', async () => {
      contentService.search.mockRejectedValue(
        new ZodError([
          {
            code: 'too_small',
            minimum: 1,
            type: 'string',
            inclusive: true,
            exact: false,
            message: 'Required',
            path: ['query'],
          },
        ]),
      );

      await expect(contentController.search({})).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
