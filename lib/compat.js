// The old API's shims. The new names are the real ones; each old name still
// works and says so, once.

const warned = new Set();

/** console.warn `old` is deprecated, once per process. */
export function deprecated(old, instead) {
  if (warned.has(old)) return;
  warned.add(old);
  console.warn(`coast-wright: ${old} is deprecated; use ${instead}.`);
}

/**
 * Reads the arguments after the data as `(project, options)` or, in the old
 * shape, `(x, y, options)`: a function in the second slot is the old shape.
 * Returns `[project, options]`.
 */
export function projection(first, second, third) {
  if (typeof second !== 'function') return [first, second];
  deprecated(
    'the x(lon, lat), y(lat, lon) callback pair',
    'one project([lon, lat]) returning [px, py]',
  );
  return [([lon, lat]) => [first(lon, lat), second(lat, lon)], third];
}

/** `options` with each deprecated name in `renames` ({ old: new }) moved to its new one. */
export function options(given = {}, renames) {
  let out = given;
  for (const [old, now] of Object.entries(renames)) {
    if (!(old in given)) continue;
    deprecated(`the \`${old}\` option`, `\`${now}\``);
    if (out === given) out = { ...given };
    if (out[now] === undefined) out[now] = given[old];
    delete out[old];
  }
  return out;
}

export const CENTRAL_MERIDIAN = { lonCenter: 'centralMeridian' };
