// SQLite lower() handles ASCII. Fold Romanian letters identically on D1 and VPS.
const letters: Record<string, string> = { Ă: 'a', ă: 'a', Â: 'a', â: 'a', Î: 'i', î: 'i', Ș: 's', ș: 's', Ş: 's', ş: 's', Ț: 't', ț: 't', Ţ: 't', ţ: 't' };
export const foldSearch = (text: string) => text.replace(/[ĂăÂâÎîȘșŞşȚțŢţ]/g, letter => letters[letter]).toLowerCase();
// Column names come only from static server-side lists, never from request input.
export const sqlFoldSearch = (column: string) => Object.entries(letters).reduce((sql, [letter, replacement]) => `replace(${sql}, '${letter}', '${replacement}')`, `lower(coalesce(${column}, ''))`);
