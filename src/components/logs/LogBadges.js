import React from 'react';
import { logLevelInfo, ACTOR_ROLES } from '../../constants/alerts';

export const LogLevelBadge = ({ level }) => {
  const l = logLevelInfo(level);
  return <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${l.className}`}>{l.label}</span>;
};

export const actorRoleLabel = (role) => ACTOR_ROLES.find(r => r.key === role)?.label || (role ? String(role) : 'System');
