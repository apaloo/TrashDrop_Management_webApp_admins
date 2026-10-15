/**
 * Extra sign-up details per company type, used by admins to verify an access
 * request (Account Approvals). Stored in account_roles.details.
 */
import { GHANA_REGIONS, isKnownDistrict } from './ghanaRegions';

const phoneOk = (v) => /^\+?[0-9 ]{9,15}$/.test(String(v || '').trim());

export const ACCOUNT_TYPE_FIELDS = {
  municipality: {
    region: 'required', district: 'required',
    help: 'Your assembly is the district you will be able to see. Use your official assembly email if you have one.',
    fields: [
      { key: 'position', label: 'Your position at the assembly', required: true, placeholder: 'e.g. Environmental Health Officer' },
      { key: 'officialPhone', label: 'Office phone', required: true, type: 'tel', placeholder: '+233 …' },
    ],
  },
  volunteer_group: {
    region: 'required', district: 'required',
    help: 'One login for the whole group. Your region is the area you will see; your district is where you mainly work.',
    fields: [
      { key: 'leaderName', label: 'Group leader', required: true },
      { key: 'leaderPhone', label: 'Leader phone', required: true, type: 'tel', placeholder: '+233 …' },
      { key: 'members', label: 'Number of members', type: 'number', placeholder: 'e.g. 12' },
    ],
  },
  nonprofit: {
    region: 'required', district: 'required',
    help: 'Your region is the area you will see; your district is where you mainly work.',
    fields: [
      { key: 'leaderName', label: 'Contact person', required: true },
      { key: 'leaderPhone', label: 'Contact phone', required: true, type: 'tel', placeholder: '+233 …' },
      { key: 'registrationNumber', label: 'NGO registration number (if any)' },
    ],
  },
  media: {
    region: 'optional', district: 'hidden',
    help: 'Media accounts see reports nationwide. Your region is optional.',
    fields: [
      { key: 'mediaHouse', label: 'Media house', required: true, placeholder: 'e.g. Citi FM, freelance' },
      { key: 'pressId', label: 'Press ID / accreditation number', required: true },
      { key: 'portfolioUrl', label: 'Link to your published work (optional)', type: 'url', placeholder: 'https://…' },
    ],
  },
  waste_management: {
    region: 'optional', district: 'optional',
    fields: [{ key: 'registrationNumber', label: 'Business registration number', required: true }],
  },
  recycling: {
    region: 'optional', district: 'optional',
    fields: [{ key: 'registrationNumber', label: 'Business registration number', required: true }],
  },
  other: { region: 'optional', district: 'optional', fields: [] },
};

export const fieldsFor = (companyType) => ACCOUNT_TYPE_FIELDS[companyType] || ACCOUNT_TYPE_FIELDS.other;

/** Label for a details key (Account Approvals) */
export const detailLabel = (key) => {
  for (const t of Object.values(ACCOUNT_TYPE_FIELDS)) {
    const f = t.fields.find(x => x.key === key);
    if (f) return f.label.replace(/ \(.*\)$/, '');
  }
  return key;
};

/**
 * Check region, district and the type's details. Returns { errors, details }
 * with details trimmed to the type's own fields.
 */
export const validateAccountDetails = (companyType, { region, district, details = {} }) => {
  const cfg = fieldsFor(companyType);
  const errors = {};
  if (cfg.region === 'required' && !region) errors.region = 'Choose your region';
  if (region && !GHANA_REGIONS.some(r => r.name === region)) errors.region = 'Choose a region from the list';
  if (cfg.district === 'required' && !district) errors.district = 'Choose your district';
  if (district && cfg.district !== 'hidden' && !isKnownDistrict(region, district)) errors.district = 'Choose a district in the selected region';
  const clean = {};
  cfg.fields.forEach(f => {
    const v = String(details[f.key] ?? '').trim();
    if (f.required && !v) errors[f.key] = `${f.label.replace(/ \(.*\)$/, '')} is required`;
    else if (v && f.type === 'tel' && !phoneOk(v)) errors[f.key] = 'Enter a valid phone number';
    else if (v && f.type === 'number' && !/^\d{1,5}$/.test(v)) errors[f.key] = 'Enter a whole number';
    else if (v && f.type === 'url' && !/^https?:\/\/\S+\.\S+/.test(v)) errors[f.key] = 'Enter a link starting with https://';
    if (v) clean[f.key] = v;
  });
  return { errors, details: clean };
};
