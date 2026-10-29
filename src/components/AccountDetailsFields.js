import React, { useState } from 'react';
import { GHANA_REGIONS, OTHER_DISTRICT, districtsOf } from '../constants/ghanaRegions';
import { fieldsFor } from '../constants/accountTypeFields';
import { suggestDistrictFromDevice } from '../utils/districtLocator';

// The sign-up form's field style (components/auth/AuthShell), without a leading icon
const inputCls = (bad) => `block w-full h-12 px-3 rounded-lg border bg-white text-base text-td-ink placeholder-gray-500 transition-colors focus:border-td-forest ${bad ? 'border-td-error ring-1 ring-td-error' : 'border-td-border-strong'}`;
const Err = ({ text }) => (text ? <p className="text-[13px] text-td-error mt-1.5">{text}</p> : null);

/**
 * Region / district and the verification details for a company type.
 * value = { region, district, details }; onChange(nextValue).
 */
const AccountDetailsFields = ({ companyType, value, onChange, errors = {} }) => {
  const cfg = fieldsFor(companyType);
  const [locating, setLocating] = useState(false);
  const [locateMsg, setLocateMsg] = useState(null);
  const set = (patch) => onChange({ ...value, ...patch });
  const setDetail = (key, v) => onChange({ ...value, details: { ...(value.details || {}), [key]: v } });

  const useLocation = async () => {
    setLocating(true);
    setLocateMsg(null);
    try {
      const found = await suggestDistrictFromDevice();
      set({ region: found.region, district: cfg.district === 'hidden' ? '' : found.district });
      setLocateMsg({ ok: true, text: `Suggested from your location: ${cfg.district === 'hidden' ? found.region : `${found.district}, ${found.region}`}. Change it if it's wrong.` });
    } catch (e) {
      setLocateMsg({ ok: false, text: e.message });
    } finally {
      setLocating(false);
    }
  };

  if (!companyType) return null;
  const showRegion = cfg.region !== 'hidden';
  const showDistrict = cfg.district !== 'hidden';

  return (
    <div className="mt-4 space-y-4" data-testid="account-details">
      {cfg.help && <p className="text-[13px] text-td-sage">{cfg.help}</p>}
      {showRegion && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="acct-region" className="block text-sm font-medium text-td-ink mb-1.5">
              Region{cfg.region === 'optional' ? <span className="text-td-sage font-normal"> (optional)</span> : ''}
            </label>
            <select id="acct-region" value={value.region || ''} className={inputCls(errors.region)}
              onChange={e => set({ region: e.target.value, district: '' })}>
              <option value="">Select region</option>
              {GHANA_REGIONS.map(r => <option key={r.name} value={r.name}>{r.name}</option>)}
            </select>
            <Err text={errors.region} />
          </div>
          {showDistrict && (
            <div>
              <label htmlFor="acct-district" className="block text-sm font-medium text-td-ink mb-1.5">
                District / Assembly{cfg.district === 'optional' ? <span className="text-td-sage font-normal"> (optional)</span> : ''}
              </label>
              <select id="acct-district" value={value.district || ''} disabled={!value.region} className={inputCls(errors.district)}
                onChange={e => set({ district: e.target.value })}>
                <option value="">{value.region ? 'Select district' : 'Choose a region first'}</option>
                {districtsOf(value.region).map(d => <option key={d} value={d}>{d}</option>)}
                {value.region && <option value={OTHER_DISTRICT}>{OTHER_DISTRICT}</option>}
              </select>
              <Err text={errors.district} />
            </div>
          )}
        </div>
      )}
      {showRegion && (
        <div className="text-sm">
          <button type="button" onClick={useLocation} disabled={locating} className="font-semibold text-td-forest hover:underline disabled:opacity-50" data-testid="use-location">
            <i className="fas fa-location-arrow mr-1" aria-hidden="true"></i>{locating ? 'Finding your district…' : 'Use my location to fill this in'}
          </button>
          {locateMsg && <p className={`mt-1 ${locateMsg.ok ? 'text-td-sage' : 'text-amber-800'}`} data-testid="locate-msg">{locateMsg.text}</p>}
        </div>
      )}
      {cfg.fields.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cfg.fields.map(f => (
            <div key={f.key}>
              <label htmlFor={`acct-${f.key}`} className="block text-sm font-medium text-td-ink mb-1.5">{f.label}</label>
              <input id={`acct-${f.key}`} type={f.type === 'number' ? 'text' : (f.type || 'text')} inputMode={f.type === 'number' ? 'numeric' : undefined}
                value={value.details?.[f.key] || ''} placeholder={f.placeholder || ''} className={inputCls(errors[f.key])}
                onChange={e => setDetail(f.key, e.target.value)} />
              <Err text={errors[f.key]} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AccountDetailsFields;
