import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS } from '../constants/accessControl';

/** Tells the account when its requested access is waiting for approval or was turned down */
const AccessStatusBanner = () => {
  const { access } = useAuth();
  if (!access || access.legacy || access.requestedRole === access.role) return null;
  const wanted = ROLE_LABELS[access.requestedRole] || access.requestedRole;
  const current = ROLE_LABELS[access.role] || 'User';

  if (access.status === 'pending') {
    return (
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status" data-testid="access-pending">
        <strong>{wanted} access is waiting for approval.</strong> You can use {current} features until the TrashDrop team approves it; you'll get a notification.
      </div>
    );
  }
  if (access.status === 'rejected') {
    return (
      <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900" role="status" data-testid="access-rejected">
        <strong>Your request for {wanted} access was not approved.</strong>{access.reviewNote ? ` Reason: ${access.reviewNote}.` : ''} Contact the TrashDrop team if you think this is wrong.
      </div>
    );
  }
  return null;
};

export default AccessStatusBanner;
