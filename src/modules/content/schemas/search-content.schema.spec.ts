import {
  CONTENT_SEARCH_MAX_ITEMS,
  searchContentSchema,
} from './search-content.schema';

const validItem = {
  id: '550e8400-e29b-41d4-a716-446655440010',
  title: 'Unit One',
  type: 'unit' as const,
  orderIndex: 0,
};

describe('searchContentSchema', () => {
  it('accepts a valid payload and trims the query', () => {
    const result = searchContentSchema.safeParse({
      query: '  الدرس الأول  ',
      items: [validItem],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query).toBe('الدرس الأول');
      expect(result.data.items).toEqual([validItem]);
    }
  });

  it('rejects an empty query after trim', () => {
    const result = searchContentSchema.safeParse({
      query: '   ',
      items: [validItem],
    });

    expect(result.success).toBe(false);
  });

  it('rejects items over the max length', () => {
    const items = Array.from(
      { length: CONTENT_SEARCH_MAX_ITEMS + 1 },
      (_, i) => ({
        ...validItem,
        id: `550e8400-e29b-41d4-a716-44665544${String(i).padStart(4, '0')}`,
        orderIndex: i,
      }),
    );

    const result = searchContentSchema.safeParse({
      query: 'unit',
      items,
    });

    expect(result.success).toBe(false);
  });

  it('rejects invalid item types and non-uuid ids', () => {
    const result = searchContentSchema.safeParse({
      query: 'unit',
      items: [
        {
          id: 'not-a-uuid',
          title: 'Broken',
          type: 'video',
          orderIndex: -1,
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it('allows an empty items array', () => {
    const result = searchContentSchema.safeParse({
      query: 'anything',
      items: [],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.items).toEqual([]);
    }
  });
});
