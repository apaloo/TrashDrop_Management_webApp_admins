import fs from 'fs';
import path from 'path';
import { validateAccountDetails, fieldsFor, detailLabel } from '../accountTypeFields';
import { GHANA_REGIONS, OTHER_DISTRICT, districtsOf, isKnownDistrict } from '../ghanaRegions';
import { findDistrict, pointInGeometry } from '../../utils/districtLocator';

describe('regions and districts', () => {
  it('has the 16 regions and 260 districts', () => {
    expect(GHANA_REGIONS).toHaveLength(16);
    expect(GHANA_REGIONS.reduce((n, r) => n + r.districts.length, 0)).toBe(260);
    expect(districtsOf('Greater Accra')).toHaveLength(29);
    expect(isKnownDistrict('Greater Accra', OTHER_DISTRICT)).toBe(true);
    expect(isKnownDistrict('Ashanti', districtsOf('Greater Accra')[0])).toBe(false);
  });
});

describe('sign-up details', () => {
  const accra = 'Greater Accra';
  const madina = districtsOf(accra).find(d => /madina/i.test(d));

  it('MMDA needs region, district, position and office phone', () => {
    const { errors } = validateAccountDetails('municipality', { region: '', district: '', details: {} });
    expect(Object.keys(errors).sort()).toEqual(['district', 'officialPhone', 'position', 'region']);
    const ok = validateAccountDetails('municipality', { region: accra, district: madina, details: { position: 'EHO', officialPhone: '+233 30 123 4567' } });
    expect(ok.errors).toEqual({});
  });

  it('volunteer group needs leader details; members must be a number', () => {
    const r = validateAccountDetails('volunteer_group', { region: accra, district: madina, details: { leaderName: 'Kojo', leaderPhone: 'abc', members: 'ten' } });
    expect(r.errors).toEqual({ leaderPhone: 'Enter a valid phone number', members: 'Enter a whole number' });
  });

  it('district must belong to the region', () => {
    const r = validateAccountDetails('volunteer_group', { region: 'Ashanti', district: madina, details: { leaderName: 'K', leaderPhone: '0244000000' } });
    expect(r.errors.district).toBeTruthy();
  });

  it('media: region optional, no district, press ID required; extra keys dropped', () => {
    expect(fieldsFor('media').district).toBe('hidden');
    const r = validateAccountDetails('media', { region: '', district: '', details: { mediaHouse: 'Citi FM', pressId: 'GJA-1', other: 'x', portfolioUrl: 'citi.com' } });
    expect(r.errors).toEqual({ portfolioUrl: 'Enter a link starting with https://' });
    expect(r.details).toEqual({ mediaHouse: 'Citi FM', pressId: 'GJA-1', portfolioUrl: 'citi.com' });
  });

  it('individual needs nothing extra', () => {
    expect(validateAccountDetails('other', { region: '', district: '', details: {} }).errors).toEqual({});
    expect(detailLabel('pressId')).toBe('Press ID / accreditation number');
  });
});

describe('use my location', () => {
  const features = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../public/data/gh-districts.json'), 'utf8')).features;

  it('finds the district and region for points in Accra and Kumasi', () => {
    expect(findDistrict(5.556, -0.1969, features)).toMatchObject({ region: 'Greater Accra' }); // Accra central
    expect(findDistrict(6.6885, -1.6244, features)).toMatchObject({ region: 'Ashanti' }); // Kumasi
    const found = findDistrict(5.556, -0.1969, features);
    expect(districtsOf(found.region)).toContain(found.district);
  });

  it('returns null outside Ghana', () => {
    expect(findDistrict(51.5, -0.12, features)).toBeNull();
    expect(pointInGeometry(0, 0, null)).toBe(false);
  });
});
