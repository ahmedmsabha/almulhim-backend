import { z } from 'zod';

export const registerUserSchema = z.object({
  fullName: z.string().trim().min(1).max(200),
  phoneNumber: z.string().trim().min(1).max(30),
  telegramUsername: z.string().trim().min(1).max(100),
  region: z.enum(['gaza', 'west_bank']),
});

export type RegisterUserInput = z.infer<typeof registerUserSchema>;
