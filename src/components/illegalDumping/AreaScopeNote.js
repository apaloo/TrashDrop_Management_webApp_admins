import React from 'react';

/** Tells an account limited to an area which reports it is seeing */
const AreaScopeNote = ({ area, readOnly }) => {
  if (!area || area.level === 'national') return null;
  if (area.level === 'home') {
    return (
      <div className="mb-4 rounded border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800" data-testid="area-home">
        <i className="fas fa-map-marked-alt mr-2" aria-hidden="true"></i>
        Showing reports in the district of your pickup address. Who reported them is not shown. Add a pickup address in the TrashDrop app if none appear.
      </div>
    );
  }
  if (area.level === 'none') {
    return (
      <div className="mb-4 rounded border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" data-testid="area-none">
        Your account has no district yet, so no reports are shown. Ask a TrashDrop admin to set your district.
      </div>
    );
  }
  const where = area.level === 'district' ? `${area.district}, ${area.region}` : `the ${area.region} region`;
  return (
    <div className="mb-4 rounded border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800" data-testid="area-scope">
      <i className="fas fa-map-marked-alt mr-2" aria-hidden="true"></i>
      Showing reports in {where}{readOnly ? '. View only: TrashDrop verifies and assigns cleanups.' : '.'}
    </div>
  );
};

export default AreaScopeNote;
