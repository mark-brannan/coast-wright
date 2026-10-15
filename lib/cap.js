// The cap: every point within an angle of a centre. It is nearly all a
// `visible` predicate ever is -- an orthographic globe's near side, an
// azimuthal chart with its antipode refused -- so the trig lives here once.

const RAD = Math.PI / 180;

/**
 * A `visible(lon, lat)` for `limn`, `fill` and the rest, admitting the points
 * strictly within `angle` degrees of arc of `[lon, lat]`. 90 is an
 * orthographic globe's near side; just under 180 is an azimuthal chart with
 * its antipode refused.
 */
export function cap([lon, lat], angle) {
  const sin0 = Math.sin(lat * RAD);
  const cos0 = Math.cos(lat * RAD);
  const limit = Math.cos(angle * RAD);
  return (lon1, lat1) =>
    sin0 * Math.sin(lat1 * RAD) + cos0 * Math.cos(lat1 * RAD) * Math.cos((lon1 - lon) * RAD) >
    limit;
}
