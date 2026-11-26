/**
 * Escapes regex metacharacters so special user queries (e.g. C++, $100, (test))
 * never throw invalid regex errors.
 */
export const escapeRegExp = (str = '') => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Checks whether a message matches a search query across text, attachment filenames,
 * and link preview metadata, while excluding deleted-for-everyone tombstones.
 */
export const doesMessageMatchQuery = (msg, query = '') => {
  if (!msg || msg.isDeletedForEveryone) return false;
  const normalized = query.trim().toLowerCase();
  if (!normalized) return false;

  if (msg.message?.toLowerCase().includes(normalized)) return true;

  if (Array.isArray(msg.attachments)) {
    const hasFileMatch = msg.attachments.some((att) =>
      att?.fileName?.toLowerCase().includes(normalized)
    );
    if (hasFileMatch) return true;
  }

  if (msg.linkPreview) {
    const { title, description, siteName, url } = msg.linkPreview;
    if (
      title?.toLowerCase().includes(normalized) ||
      description?.toLowerCase().includes(normalized) ||
      siteName?.toLowerCase().includes(normalized) ||
      url?.toLowerCase().includes(normalized)
    ) {
      return true;
    }
  }

  return false;
};

/**
 * Extracts the most relevant text snippet for a global search result item.
 */
export const getSearchSnippet = (msg, query = '') => {
  if (!msg) return '';
  const normalized = query.trim().toLowerCase();

  if (msg.message?.toLowerCase().includes(normalized)) {
    return msg.message;
  }

  const matchedAttachment = msg.attachments?.find((att) =>
    att?.fileName?.toLowerCase().includes(normalized)
  );
  if (matchedAttachment?.fileName) {
    return `📎 ${matchedAttachment.fileName}`;
  }

  if (msg.linkPreview?.title?.toLowerCase().includes(normalized)) {
    return `🔗 ${msg.linkPreview.title}`;
  }

  if (msg.linkPreview?.description?.toLowerCase().includes(normalized)) {
    return `🔗 ${msg.linkPreview.description}`;
  }

  if (msg.linkPreview?.siteName?.toLowerCase().includes(normalized)) {
    return `🔗 ${msg.linkPreview.siteName}`;
  }

  if (msg.linkPreview?.url?.toLowerCase().includes(normalized)) {
    return `🔗 ${msg.linkPreview.url}`;
  }

  if (msg.linkPreview?.title) {
    return `🔗 ${msg.linkPreview.title}`;
  }

  return msg.message || msg.attachments?.[0]?.fileName || 'Message';
};

/**
 * Splits a string into plain and highlighted segments for safe React rendering.
 * @returns {Array<{ text: string, isMatch: boolean }>}
 */
export const splitTextByHighlight = (text = '', query = '') => {
  if (!text || typeof text !== 'string') return [{ text: text || '', isMatch: false }];
  const trimmed = query.trim();
  if (!trimmed) return [{ text, isMatch: false }];

  const regex = new RegExp(`(${escapeRegExp(trimmed)})`, 'gi');
  const parts = text.split(regex);
  const lowerQuery = trimmed.toLowerCase();

  return parts
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      isMatch: part.toLowerCase() === lowerQuery,
    }));
};
