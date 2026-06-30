import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../lib/database/prisma.service';
import type { User } from '../../generated/prisma/client';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async findUserByClerkId(clerkId: string): Promise<User | null> {
    try {
      return await this.prismaService.user.findUnique({
        where: { clerkId },
      });
    } catch (error) {
      this.logger.error(`Failed to find user for clerkId ${clerkId}`, error);
      throw error;
    }
  }
}
