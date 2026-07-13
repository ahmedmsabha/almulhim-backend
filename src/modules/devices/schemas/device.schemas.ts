import { z } from 'zod';

export const bindDeviceSchema = z.object({
  deviceType: z.enum(['web', 'mobile']),
  deviceIdentifier: z.string().min(16).max(128),
});

export type BindDeviceInput = z.infer<typeof bindDeviceSchema>;

export const adminDeviceTypeParamSchema = z.enum(['web', 'mobile']);
