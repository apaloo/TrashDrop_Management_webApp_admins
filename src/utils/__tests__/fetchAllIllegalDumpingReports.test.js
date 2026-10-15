import { fetchAllIllegalDumpingReports } from '../databaseUtils';
import * as realDataUtils from '../realDataUtils';

jest.mock('../realDataUtils', () => ({ fetchIllegalDumpingReports: jest.fn() }));
jest.mock('../supabase', () => ({ supabase: {} }));

it('pages through every report (150 rows, 100 per page)', async () => {
  const all = Array.from({ length: 150 }, (_, i) => ({ id: String(i) }));
  realDataUtils.fetchIllegalDumpingReports.mockImplementation(async ({ limit, page }) => ({
    data: all.slice((page - 1) * limit, page * limit),
    totalCount: all.length,
  }));

  const rows = await fetchAllIllegalDumpingReports({ pageSize: 100 });

  expect(rows).toHaveLength(150);
  expect(realDataUtils.fetchIllegalDumpingReports).toHaveBeenCalledTimes(2);
  expect(realDataUtils.fetchIllegalDumpingReports).toHaveBeenLastCalledWith({ status: null, limit: 100, page: 2, area: null });
});
