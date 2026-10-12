/**
 * Service zones (service_zones table, falling back to src/config/serviceZones.js
 * until supabase/migrations/20261016_collectors_admin.sql is run).
 */
import { supabase } from '../utils/supabase';
import { DEFAULT_SERVICE_ZONES } from '../config/serviceZones';

/** @returns {Promise<{ zones: string[], source: 'database'|'config' }>} */
export const fetchServiceZones = async () => {
  try {
    const { data, error } = await supabase
      .from('service_zones')
      .select('name, sort_order')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });
    if (!error && data && data.length) return { zones: data.map(z => z.name), source: 'database' };
  } catch (error) {
    // fall through to the built-in list
  }
  return { zones: DEFAULT_SERVICE_ZONES, source: 'config' };
};
