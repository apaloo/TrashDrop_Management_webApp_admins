import React, { useEffect, useState } from 'react';
import { card, input, muted, border } from '../pickupRequests/theme';
import { ALERT_RULES, GENERAL_RULE_KEY } from '../../constants/alerts';
import { fetchRuleSettings, saveRuleSetting, runRules } from '../../services/alertAdminService';

const RESULT_COLUMNS = [['matched', 'Matched'], ['already_open', 'Already open'], ['created', 'New'], ['escalated', 'Escalated'], ['resolved', 'Resolved']];

/**
 * On/off and thresholds for each automatic rule (alert_rule_settings), plus
 * a dry run ("Preview") and "Run now". The job itself runs every 5 minutes.
 */
const AlertRulesPanel = ({ userId, onToast, onRan }) => {
  const [settings, setSettings] = useState(undefined); // undefined = loading, null = table missing
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(null);
  const [results, setResults] = useState(null);

  useEffect(() => {
    fetchRuleSettings()
      .then(s => { setSettings(s); setDraft(s ? JSON.parse(JSON.stringify(s)) : {}); })
      .catch(error => { setSettings(null); onToast(error.message, 'error'); });
  }, [onToast]);

  if (settings === undefined) return <div className="rounded-xl border p-4 text-sm" style={card}>Loading rule settings…</div>;
  if (settings === null) {
    return (
      <div className="rounded-xl border p-4 text-sm" style={card}>
        <p className="font-medium">Alert rules aren't set up yet.</p>
        <p style={muted}>Run supabase/migrations/20261017_alerts_rules.sql, then enable pg_cron, to turn on automatic alerts.</p>
      </div>
    );
  }

  const ruleOf = (key) => draft[key] || { enabled: true, params: {} };
  const setRule = (key, patch) => setDraft(d => ({ ...d, [key]: { ...ruleOf(key), ...patch } }));
  const setParam = (key, p, value) => setRule(key, { params: { ...ruleOf(key).params, [p]: value === '' ? '' : Number(value) } });
  const dirty = Object.keys(draft).filter(k => JSON.stringify(draft[k]) !== JSON.stringify(settings[k]));

  const save = async () => {
    setSaving(true);
    try {
      for (const key of dirty) {
        const params = Object.fromEntries(Object.entries(draft[key].params || {}).filter(([, v]) => v !== '' && Number.isFinite(Number(v))));
        await saveRuleSetting(key, { enabled: draft[key].enabled, params }, userId);
      }
      setSettings(JSON.parse(JSON.stringify(draft)));
      onToast(`Saved ${dirty.length} rule setting${dirty.length === 1 ? '' : 's'}`);
    } catch (error) {
      onToast(error.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const run = async (dry) => {
    setRunning(dry ? 'dry' : 'live');
    try {
      const rows = await runRules(dry);
      setResults({ dry, rows, at: new Date() });
      if (!dry) {
        const created = rows.reduce((s, r) => s + (r.created || 0), 0);
        const resolved = rows.reduce((s, r) => s + (r.resolved || 0), 0);
        onToast(`Rules ran: ${created} new, ${resolved} resolved`);
        onRan?.();
      }
    } catch (error) {
      onToast(error.message, 'error');
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="rounded-xl border" style={card} data-testid="rules-panel">
      <div className="px-4 py-3 border-b flex flex-wrap items-center gap-2" style={border}>
        <div className="mr-auto">
          <h2 className="font-semibold">Alert rules</h2>
          <p className="text-xs" style={muted}>Checked every 5 minutes. One open alert per rule and record; it resolves itself when the problem clears.</p>
        </div>
        <button type="button" onClick={() => run(true)} disabled={!!running} className="px-3 py-1.5 rounded border text-sm disabled:opacity-40" style={border}>
          {running === 'dry' ? 'Checking…' : 'Preview (no changes)'}
        </button>
        <button type="button" onClick={() => run(false)} disabled={!!running || dirty.length > 0} title={dirty.length ? 'Save your changes first' : ''}
          className="px-3 py-1.5 rounded border text-sm disabled:opacity-40" style={border}>{running === 'live' ? 'Running…' : 'Run now'}</button>
        <button type="button" onClick={save} disabled={saving || dirty.length === 0}
          className="px-3 py-1.5 rounded text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-40">
          {saving ? 'Saving…' : `Save${dirty.length ? ` (${dirty.length})` : ''}`}
        </button>
      </div>

      <ul className="divide-y" style={border}>
        {ALERT_RULES.map(rule => {
          const s = ruleOf(rule.key);
          const result = results?.rows.find(r => r.rule_key === rule.key);
          return (
            <li key={rule.key} className="px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2" style={border} data-testid={`rule-${rule.key}`}>
              <label className="flex items-center gap-2 min-w-[16rem] flex-1">
                <input type="checkbox" checked={!!s.enabled} onChange={e => setRule(rule.key, { enabled: e.target.checked })} aria-label={`Enable ${rule.label}`} />
                <span>
                  <span className="text-sm font-medium">{rule.label}</span>
                  <span className="block text-xs" style={muted}>Priority: {rule.priority}</span>
                </span>
              </label>
              {rule.params.map(p => (
                <label key={p.key} className="text-xs" style={muted}>
                  <span className="block mb-0.5">{p.label}</span>
                  <input type="number" min={p.min} max={p.max} value={s.params?.[p.key] ?? ''} disabled={!s.enabled}
                    onChange={e => setParam(rule.key, p.key, e.target.value)} className="w-24 border rounded px-2 py-1 text-sm" style={input} />
                </label>
              ))}
              {result && (
                <span className="text-xs w-full sm:w-auto" style={muted} data-testid={`rule-result-${rule.key}`}>
                  {result.note ? result.note : RESULT_COLUMNS.map(([k, l]) => `${l} ${result[k]}`).join(' · ')}
                </span>
              )}
            </li>
          );
        })}
        <li className="px-4 py-3 flex flex-wrap items-center gap-3 text-sm" style={border}>
          <span className="flex-1 min-w-[16rem]">After someone resolves or closes a rule alert, don't raise it again for</span>
          <label className="text-xs" style={muted}>
            <input type="number" min="0" value={ruleOf(GENERAL_RULE_KEY).params?.snooze_hours ?? 24}
              onChange={e => setParam(GENERAL_RULE_KEY, 'snooze_hours', e.target.value)} className="w-20 border rounded px-2 py-1 text-sm mr-1" style={input} aria-label="Snooze hours" />
            hours
          </label>
        </li>
      </ul>
      {results && (
        <p className="px-4 py-2 text-xs border-t" style={{ ...muted, ...border }}>
          {results.dry ? 'Preview' : 'Run'} at {results.at.toLocaleTimeString()}: {results.dry ? 'nothing was changed. "New" = alerts that would be created.' : 'alerts updated.'}
        </p>
      )}
    </div>
  );
};

export default AlertRulesPanel;
