import React from 'react';
import { bagStageInfo } from '../../constants/bagStatus';

/** Step pill (Generated, Distributed, Filled, Collected, Processed, Archived) */
const BagStageBadge = ({ stage }) => {
  const s = bagStageInfo(stage);
  return <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${s.className}`}>{s.label}</span>;
};

export default BagStageBadge;
