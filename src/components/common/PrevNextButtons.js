import React from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

/**
 * Previous / Next chevrons for a details window, to step through the list
 * behind it without closing. Pass null for an end with nothing to go to; the
 * label (e.g. "3 of 20") sits between them when given.
 */
const PrevNextButtons = ({ onPrevious, onNext, label, noun = 'item' }) => {
  const button = 'p-1.5 rounded-full border border-td-border text-td-ink hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed';
  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <button type="button" onClick={onPrevious || undefined} disabled={!onPrevious} className={button} aria-label={`Previous ${noun}`} title={`Previous ${noun}`}>
        <FiChevronLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      {label && <span className="text-xs text-td-sage whitespace-nowrap">{label}</span>}
      <button type="button" onClick={onNext || undefined} disabled={!onNext} className={button} aria-label={`Next ${noun}`} title={`Next ${noun}`}>
        <FiChevronRight className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );
};

export default PrevNextButtons;
