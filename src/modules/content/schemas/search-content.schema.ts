import { z } from 'zod';

export const CONTENT_SEARCH_MAX_ITEMS = 500;

export const searchContentItemSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1),
  type: z.enum(['unit', 'chapter', 'lesson']),
  orderIndex: z.number().int().min(0),
});

export const searchContentSchema = z.object({
  query: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, 'query must not be empty after trim')),
  items: z
    .array(searchContentItemSchema)
    .max(
      CONTENT_SEARCH_MAX_ITEMS,
      `items must contain at most ${CONTENT_SEARCH_MAX_ITEMS} entries`,
    ),
});

export type SearchContentItem = z.infer<typeof searchContentItemSchema>;
export type SearchContentInput = z.infer<typeof searchContentSchema>;
