import { describe, expect, it } from 'vitest';

import {
  decodePageCursor,
  encodePageCursor,
  InvalidCursorError
} from '../src/services/pagination.js';

describe('opaque pagination cursors', () => {
  it('round-trips only for the same tool and filter context', () => {
    const cursor = encodePageCursor(20, 'search_revogrid_docs', {
      query: 'pivot',
      product: 'pivot',
      snapshot: 'snapshot-a'
    });

    expect(decodePageCursor(cursor, 'search_revogrid_docs', {
      snapshot: 'snapshot-a',
      product: 'pivot',
      query: 'pivot'
    })).toBe(20);
    expect(() => decodePageCursor(cursor, 'find_examples', {
      query: 'pivot',
      product: 'pivot',
      snapshot: 'snapshot-a'
    })).toThrow(InvalidCursorError);
    expect(() => decodePageCursor(cursor, 'search_revogrid_docs', {
      query: 'pivot',
      product: 'pivot',
      snapshot: 'snapshot-b'
    })).toThrow(InvalidCursorError);
  });

  it('rejects malformed cursors instead of silently restarting pagination', () => {
    expect(() => decodePageCursor('not-a-valid-cursor', 'search_revogrid_docs', {}))
      .toThrow(InvalidCursorError);
  });
});
