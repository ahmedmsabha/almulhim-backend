jest.mock('../../lib/database/prisma.service', () => ({
  PrismaService: class MockPrismaService {
    user = {
      findUnique: jest.fn(),
    };
  },
}));

import { AuthService } from './auth.service';
import { PrismaService } from '../../lib/database/prisma.service';

describe('AuthService', () => {
  let authService: AuthService;
  let prismaService: PrismaService;

  beforeEach(() => {
    prismaService = new PrismaService({} as never);
    authService = new AuthService(prismaService);
  });

  it('finds a user by clerk id', async () => {
    const user = {
      id: 'uuid',
      clerkId: 'user_123',
      email: 'admin@example.com',
      fullName: 'Admin',
      phoneNumber: '1234567890',
      telegramUsername: 'admin',
      region: 'gaza' as const,
      role: 'admin' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    jest.spyOn(prismaService.user, 'findUnique').mockResolvedValue(user);

    await expect(authService.findUserByClerkId('user_123')).resolves.toEqual(
      user,
    );
    expect(prismaService.user.findUnique).toHaveBeenCalledWith({
      where: { clerkId: 'user_123' },
    });
  });
});
