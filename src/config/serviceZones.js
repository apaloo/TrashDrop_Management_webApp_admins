/**
 * Service zones collectors are assigned to. The live list is the
 * service_zones table (supabase/migrations/20261016_collectors_admin.sql,
 * editable without a deploy); this copy is used until that table exists.
 * Keep the two in step.
 */
export const DEFAULT_SERVICE_ZONES = [
  'Accra – Ga North',
  'Accra – Ga South',
  'Accra – Ga East',
  'Accra – Ga West',
  'Accra – Ga Central',
  'Accra – Ayawaso West',
  'Accra – Ayawaso East',
  'Accra – Okaikwei North',
  'Accra – Ablekuma',
  'Accra – Accra Metro',
  'Accra – La Dade-Kotopon',
  'Accra – Ledzokuku',
  'Accra – Adentan',
  'Accra – La Nkwantanang-Madina',
  'Tema',
  'Kasoa',
  'Kumasi',
  'Tamale',
  'Takoradi',
  'Cape Coast',
];
