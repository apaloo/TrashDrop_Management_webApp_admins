import logger from './logger';
import { supabase } from './supabase';
import { secureUrls } from './secureUrl';
import { fetchAreaDumpingReports } from '../services/dumpingAreaService';

/**
 * Fetch real collector statistics from Supabase
 * @returns {Promise<Object>} Collector statistics
 */
export const fetchCollectorStats = async () => {
  try {
    const { data, error } = await supabase
      .from('collector_profiles')
      .select('id, first_name, last_name, status, rating, created_at, total_collections, assigned_region');

    if (error) throw error;

    const collectors = (data || []).map((collector) => ({
      ...collector,
      status: (collector.status || '').toLowerCase(),
      fullName: `${collector.first_name ?? ''} ${collector.last_name ?? ''}`.trim()
    }));

    const total = collectors.length;
    const active = collectors.filter(c => c.status === 'active').length;
    const inactive = collectors.filter(c => c.status === 'inactive').length;
    
    // Get collectors created this month
    const thisMonth = new Date();
    thisMonth.setDate(1);
    const newThisMonth = collectors.filter(c => 
      c.created_at && new Date(c.created_at) >= thisMonth
    ).length;
    
    // Calculate average rating
    const ratedCollectors = collectors.filter(c => typeof c.rating === 'number');
    const ratingsSum = ratedCollectors.reduce((sum, c) => sum + c.rating, 0);
    const avgRating = ratedCollectors.length > 0 ? ratingsSum / ratedCollectors.length : 0;
    
    // Find top collector
    const topCollector = collectors.reduce((top, current) => {
      const currentTotal = current.total_collections ?? 0;
      const topTotal = top.total_collections ?? 0;
      return currentTotal > topTotal ? current : top;
    }, collectors[0] || {});

    // Get unique regions count (fallback to 4 if query fails)
    const { data: regionData, error: regionError } = await supabase
      .from('service_areas')
      .select('id, name');
      
    const regions = regionError ? 4 : (regionData?.length || 4);

    return {
      total,
      active,
      inactive,
      new_this_month: newThisMonth,
      average_rating: Math.round(avgRating * 10) / 10,
      regions,
      top_collector: {
        name: (topCollector.fullName || topCollector.email || 'No collectors').trim(),
        collections: topCollector.total_collections || 0,
        rating: topCollector.rating || 0
      }
    };
  } catch (error) {
    console.error('Error fetching collector stats:', error);
    throw error;
  }
};

/**
 * Fetch illegal dumping reports from Supabase with pagination
 * @deprecated RPC function 'fetch_illegal_dumping_reports' no longer exists - using direct table queries
 * @param {Object} options - Query options (page, limit, status)
 * @returns {Promise<Object>} Paginated illegal dumping reports
 */
// Runs an .in() lookup in batches so long id lists don't exceed URL limits.
const selectInBatches = async (table, columns, column, ids, size = 100) => {
  const rows = [];
  for (let i = 0; i < ids.length; i += size) {
    const { data, error } = await supabase.from(table).select(columns).in(column, ids.slice(i, i + size));
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
};

const parseCoordinate = (value) => {
  const n = typeof value === 'number' ? value : parseFloat(value);
  return Number.isFinite(n) ? n : null;
};

// Reporter names for a set of reported_by ids. Best effort: returns {} if the lookup fails.
const fetchReportersById = async (ids) => {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return {};
  try {
    const data = await selectInBatches('profiles', 'id, first_name, last_name, email', 'id', unique);
    return Object.fromEntries(data.map(p => [p.id, p]));
  } catch (err) {
    console.warn('Could not load reporter profiles for dumping reports:', err.message);
    return {};
  }
};

// The household app stores the reporter's description in dumping_reports_mobile. Best effort.
const fetchDumpingDetailsById = async (ids) => {
  if (!ids.length) return {};
  try {
    const data = await selectInBatches('dumping_reports_mobile', 'dumping_id, accessibility_notes, estimated_volume, hazardous_materials', 'dumping_id', ids);
    return Object.fromEntries(data.map(d => [d.dumping_id, d]));
  } catch (err) {
    console.warn('Could not load dumping report details:', err.message);
    return {};
  }
};

/**
 * Reports from area_dumping_reports() (20261104) in the same shape as below,
 * with the reporter hidden and no free-text description.
 */
const fetchPrivateDumpingReports = async ({ page, limit, status }) => {
  const rows = await fetchAreaDumpingReports({ status });
  const all = rows.map(r => {
    const status = String(r.status || 'pending').toLowerCase();
    const severity = String(r.severity || 'medium').toLowerCase();
    const wasteType = String(r.waste_type || 'mixed').toLowerCase();
    return {
      id: r.id,
      location: { address: r.area_name || [r.district, r.region].filter(Boolean).join(', ') || 'Location not specified', lat: parseCoordinate(r.latitude), lng: parseCoordinate(r.longitude) },
      reporter: { id: null, name: null, email: null, anonymous: false, hidden: true },
      status,
      severity,
      waste_type: wasteType,
      size: r.size || 'medium',
      estimated_volume: null,
      hazardous_materials: null,
      description: `${wasteType} dumping - ${severity} severity`,
      description_is_generated: true,
      images: secureUrls(r.photos),
      reported_at: r.reported_at,
      updated_at: r.updated_at,
      resolved_at: r.completed_at || null,
      area_name: r.area_name || null,
      region: r.region || null,
      district: r.district || null,
      notes: null,
      cleanup_fee: null,
      disposed_at: r.disposed_at || null,
      disposal_site_name: r.disposal_site_name || null,
      assigned_to: r.assigned_to || null,
      assigned_via: r.assigned_via || null,
      cleanup_photos: secureUrls(r.cleanup_photos),
      assignee: r.assigned_to ? { id: r.assigned_to } : null,
      team_name: r.team_name || null,
    };
  });
  const start = (page - 1) * limit;
  return { data: all.slice(start, start + limit), totalCount: all.length, page, limit, totalPages: Math.ceil(all.length / limit) };
};

export const fetchIllegalDumpingReports = async (options = {}) => {
  // Ensure options is an object to prevent null/undefined errors
  const safeOptions = options || {};
  const { page = 1, limit = 10, status = null, area = null, privateView = false } = safeOptions;
  // Media, Volunteer and User accounts: their area only, without reporter details (the database picks the area)
  if (privateView) return fetchPrivateDumpingReports({ page, limit, status });
  // area: { level: 'national' | 'region' | 'district' | 'none', region, district } (areaScopeFor)
  if (area?.level === 'none') return { data: [], totalCount: 0, page, limit, totalPages: 0 };

  // DEPRECATED: RPC function removed, using direct table queries only
  logger.log('Using direct table query for illegal dumping reports (RPC deprecated)');
  
  try {
    const offset = (page - 1) * limit;
    
    let query = supabase
      .from('illegal_dumping_mobile')
      .select(`
        *,
        assignee:collector_profiles!assigned_to(id, first_name, last_name)
      `, { count: 'exact' });

    if (status) {
      query = query.eq('status', status);
    }
    if (area?.level === 'district') query = query.eq('district', area.district);
    if (area?.level === 'region') query = query.eq('region', area.region);

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    const rows = data || [];
    const [reportersById, detailsById] = await Promise.all([
      fetchReportersById(rows.map(r => r.reported_by)),
      fetchDumpingDetailsById(rows.map(r => r.id)),
    ]);

    // Transform the data. Values are passed through as stored (the household app
    // writes lowercase severity/waste_type); callers compare them case-insensitively.
    const transformedData = rows.map(report => {
      const lat = parseCoordinate(report.latitude ?? report.coordinates?.coordinates?.[1]);
      const lng = parseCoordinate(report.longitude ?? report.coordinates?.coordinates?.[0]);
      const severity = String(report.severity ?? report.severity_level ?? 'medium').trim().toLowerCase();
      const wasteType = String(report.waste_type ?? report.type ?? 'mixed').trim().toLowerCase();
      const status = String(report.status || 'pending').trim().toLowerCase();
      const details = detailsById[report.id];
      const reporter = reportersById[report.reported_by];
      const userDescription = report.description || details?.accessibility_notes || report.notes || null;
      const isCleaned = status === 'completed' || status === 'disposed';

      return {
        id: report.id,
        location: {
          address: report.location || 'Location not specified',
          // No fallback point: a report without coordinates must not be plotted in Accra
          lat,
          lng
        },
        reporter: reporter
          ? { id: reporter.id, name: [reporter.first_name, reporter.last_name].filter(Boolean).join(' ') || null, email: reporter.email || null, anonymous: false }
          : { id: report.reported_by || null, name: null, email: null, anonymous: !report.reported_by },
        status,
        severity,
        waste_type: wasteType,
        size: report.size || 'medium',
        estimated_volume: details?.estimated_volume ?? null,
        hazardous_materials: details?.hazardous_materials ?? null,
        description: userDescription || `${wasteType} dumping - ${severity} severity`,
        description_is_generated: !userDescription,
        images: secureUrls(report.photos),
        reported_at: report.created_at,
        updated_at: report.updated_at,
        // completed_at is stamped by a trigger when the report is completed
        // (migration 20261012); older rows fall back to updated_at.
        resolved_at: isCleaned
          ? (report.completed_at || report.cleanup_completed_date || report.resolved_at || report.updated_at || null)
          : null,
        area_name: report.area_name || null,
        notes: report.notes || null,
        cleanup_fee: report.cleanup_fee ?? null,
        disposed_at: report.disposed_at || null,
        disposal_site_name: report.disposal_site_name || null,
        assigned_to: report.assigned_to || null,
        // 'claim' = taken by a volunteer group in the collector app (20261028)
        assigned_via: report.assigned_via || null,
        cleanup_photos: secureUrls(report.cleanup_photos),
        assignee: report.assignee || null,
        team_name: report.assignee ? [report.assignee.first_name, report.assignee.last_name].filter(Boolean).join(' ') || null : null,
      };
    });

    return {
      data: transformedData,
      totalCount: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    };
  } catch (error) {
    console.error('Error fetching illegal dumping reports:', error);
    throw error;
  }
};
