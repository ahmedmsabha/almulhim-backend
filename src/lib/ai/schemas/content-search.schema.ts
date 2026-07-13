import { z } from 'zod';

export const contentSearchResultSchema = z.object({
  matchingIds: z
    .array(z.string().uuid())
    .describe(
      'IDs of content items from the provided list that match the search query intent. Return only IDs that appear in the input list.',
    ),
});

export type ContentSearchResult = z.infer<typeof contentSearchResultSchema>;
