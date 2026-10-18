/**
 * Image and media links from the database or from users, made safe to load on
 * the HTTPS site. A single http:// image makes Chrome mark the whole page
 * "Not Secure" (mixed content), so every DB-supplied link goes through here
 * before it is rendered or saved.
 */

/** http://… → https://…; anything else (https:, data:, relative paths, null) is left as it is */
export const secureUrl = (u) =>
  typeof u === 'string' ? u.trim().replace(/^http:\/\//i, 'https://') : u;

/** secureUrl for each entry of a list; a non-list gives [] */
export const secureUrls = (list) => (Array.isArray(list) ? list.map(secureUrl) : []);
