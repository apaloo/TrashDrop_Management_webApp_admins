const mockCalls = [];
let mockNextError = null;

jest.mock('../supabase', () => ({
  supabase: {
    from: (table) => ({
      select: (columns, options) => ({
        limit: async (n) => {
          mockCalls.push({ table, columns, options, limit: n });
          return { error: mockNextError };
        },
      }),
    }),
  },
}));

const { safeDatabaseService } = require('../safeDatabaseService');

describe('checkTableExists', () => {
  beforeEach(() => { mockCalls.length = 0; mockNextError = null; });

  it('asks for one row with no count', async () => {
    expect(await safeDatabaseService.checkTableExists('notifications')).toBe(true);
    expect(mockCalls).toEqual([{ table: 'notifications', columns: '*', options: { head: true }, limit: 1 }]);
  });

  it('treats a body-less server error (e.g. a 503) as "exists", so the real query still runs', async () => {
    mockNextError = { code: '', message: '' };
    expect(await safeDatabaseService.checkTableExists('notifications')).toBe(true);
  });

  it('reports a missing table', async () => {
    mockNextError = { code: '42P01', message: 'relation "public.nope" does not exist' };
    expect(await safeDatabaseService.checkTableExists('nope')).toBe(false);
  });
});
