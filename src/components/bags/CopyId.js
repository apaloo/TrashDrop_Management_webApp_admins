import React, { useState } from 'react';
import { shortId } from '../../utils/pickupRequestUtils';

/** First 8 characters of an id, full id on hover, copy button */
const CopyId = ({ id, className = '' }) => {
  const [copied, setCopied] = useState(false);
  const copy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      window.prompt('Copy the batch ID', id); // clipboard blocked (e.g. http)
    }
  };
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <span className="font-mono text-xs" title={id}>{shortId(id)}</span>
      <button type="button" onClick={copy} className="text-xs text-gray-400 hover:text-green-700" title="Copy full ID" aria-label={`Copy ID ${id}`}>
        {copied ? '✓' : '⧉'}
      </button>
    </span>
  );
};

export default CopyId;
