import React from 'react';
import { splitTextByHighlight } from '../../utils/searchUtils';

/**
 * Pure UI component for rendering text with search-match highlighting.
 */
const HighlightText = ({
  text = '',
  query = '',
  isActiveMatch = false,
  markClassName = '',
}) => {
  if (!query?.trim() || !text) {
    return <>{text}</>;
  }

  const segments = splitTextByHighlight(text, query);
  const defaultMarkStyle = isActiveMatch
    ? 'bg-amber-400 text-slate-950 rounded px-0.5 font-semibold shadow-sm'
    : 'bg-amber-200/90 dark:bg-amber-400/35 text-slate-950 dark:text-amber-100 rounded px-0.5';

  return (
    <>
      {segments.map((seg, idx) =>
        seg.isMatch ? (
          <mark key={idx} className={markClassName || defaultMarkStyle}>
            {seg.text}
          </mark>
        ) : (
          <React.Fragment key={idx}>{seg.text}</React.Fragment>
        )
      )}
    </>
  );
};

export default HighlightText;
