import { z } from 'zod';

export const HOME_VIDEO_TITLE_SIZES = ['sm', 'md', 'lg', 'xl'] as const;
export const HOME_VIDEO_TITLE_COLORS = [
  'default',
  'muted',
  'primary',
  'gold',
] as const;

export type HomeVideoTitleSize = (typeof HOME_VIDEO_TITLE_SIZES)[number];
export type HomeVideoTitleColor = (typeof HOME_VIDEO_TITLE_COLORS)[number];

export const HOME_VIDEO_TITLE_MAX_LINES = 4;

export const homeVideoTitleLineSchema = z.object({
  text: z.string().trim().min(1).max(120),
  size: z.enum(HOME_VIDEO_TITLE_SIZES).default('md'),
  color: z.enum(HOME_VIDEO_TITLE_COLORS).default('default'),
});

export const homeVideoTitleLinesSchema = z
  .array(homeVideoTitleLineSchema)
  .min(1)
  .max(HOME_VIDEO_TITLE_MAX_LINES);

export type HomeVideoTitleLine = z.infer<typeof homeVideoTitleLineSchema>;

/**
 * Prisma hands back `Json` columns untyped, so narrow instead of casting.
 * Malformed rows degrade to `null` and every renderer falls back to `title`.
 */
export const parseStoredTitleLines = (
  value: unknown,
): HomeVideoTitleLine[] | null => {
  if (value == null) return null;
  const result = homeVideoTitleLinesSchema.safeParse(value);
  return result.success ? result.data : null;
};

export const titleLinesToPlainText = (
  lines: HomeVideoTitleLine[],
): string => lines.map((line) => line.text).join(' ');
