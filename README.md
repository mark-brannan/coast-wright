# coast-wright

**[One map, fourteen projections.][demo]** Pick one and watch the world
redraw.

[![The same coastline three ways: a Mollweide oval, an orthographic globe over Fiji, an azimuthal equidistant disc from the pole](demo/gallery.svg)][demo]

Same coastline, same drawing call, fourteen projections — the [demo][demo]
prints the few lines of arithmetic that did change next to the map, and the
boat drags across the date line and over the pole without the map tearing.

> **Alpha.** The code is lifted from a shipping plugin and its tests came with
> it, but the API may still move before 0.1.

Draw a coastline onto a canvas, through whatever projection you already have.
Feed it GeoJSON as published — [Natural Earth][ne] draws as-is, every island
kept, no decoder and no simplification step in between.

```js
import { geojsonRings, limn } from 'coast-wright'

const coastline = await (await fetch('./ne_50m_coastline.geojson')).json()

limn(ctx, geojsonRings(coastline), lon => /* → px */, lat => /* → py */, {
  color: '#8ab',
  lonCenter: 0,
})
```

No dependencies. No projection of its own. A couple of hundred lines.

## Why it isn't a for-loop

Because of two things that are only obvious after they have gone wrong on a
screen at sea:

**The seam.** A ring crossing the antimeridian holds two points a tenth of a
degree apart on the ground and 360 apart in the numbers. Joined, they lay a
line straight across the map. So does a ring passing behind a window centred
anywhere but Greenwich — which is why `limn` tests each segment against
`lonCenter`, the longitude your projection measures from, rather than against
the dateline. A dateline-only guard looks correct until somebody centres the
map on their own boat. And a projection that does not wrap has a seam of its
own: a `visible` predicate lets it refuse the far hemisphere of a globe, or
the antipode an azimuthal chart divides by zero on, instead.

**The projection.** `limn` takes your `x` and `y` functions and assumes
nothing else. Equirectangular, azimuthal over a pole, a band around a vessel —
all the same call. The reason coastline data gets drawn by hand instead of
borrowed is usually that every library brought its own Web Mercator, and
Mercator cannot show a pole.

## API

### `geojsonRings(geojson)` → `[[lon, lat], …][]`

Every line and polygon ring of a GeoJSON document, flattened in source order,
as `[lon, lat]` pairs. Takes a `FeatureCollection`, a `Feature` or a bare
geometry; points are skipped, there being nothing to stroke. This is what you
hand to `limn`.

Cached per document: a map redraws on every resize, and a full-detail
coastline is tens of thousands of points. The returned array is shared, so do
not mutate it. Input that is not GeoJSON throws rather than drawing something
wrong.

### `limn(ctx, rings, x, y, options)`

Strokes rings onto a canvas 2D context. `x` and `y` each receive the other
coordinate as a second argument — `x(lon, lat)` and `y(lat, lon)` — because
outside the cylindrical family neither output is computable from one
coordinate alone. A function that ignores the second argument keeps working
unchanged.

| Option | Default | |
| --- | --- | --- |
| `color` | context's own | Stroke style. |
| `alpha` | `0.45` | Coastline under data wants to stay under it. |
| `width` | `1` | Line width in pixels. |
| `lonCenter` | `0` | The longitude your projection measures from. Get this right or the seam guard guards the wrong place. |
| `visible` | — | `(lon, lat) => bool`, for projections whose seam is not a wrap. A refused point lifts the pen and is never even projected — orthographic hides the far hemisphere, azimuthal equidistant masks the antipode its arithmetic divides by zero on. The wrap guard keeps running alongside. |

### Portolano decoding, kept for now

An earlier design encoded the coastline into a compact format of its own,
the [portolano][spec]. Measured against the plain Natural Earth file it saved
a few tens of kilobytes and cost position accuracy and the small islands,
so new work draws GeoJSON instead; the [post-mortem][pm] has the numbers.
The decoder stays exported until its retirement is decided, so existing
callers keep working:

- `rings(portolano)` → every ring, flattened across polygons, cached per
  document.
- `polygons(portolano)` → `[[outer, …holes], …]`, holes kept. Fill even-odd;
  winding order is not promised.
- `decodeRing(encoded, precision)` → one ring; take `precision` from the
  document, profiles differ.

`rings` and `polygons` refuse a document whose `format` or coordinate order
they do not recognise.

## Data

[Natural Earth][ne] is public domain and publishes its coastline as GeoJSON
at three scales, 110m, 50m and 10m. Nothing is bundled here: pick the scale
by measuring parse and draw time on your own target, then pin the version
and check its hash at build. The plugin this came from pins v5.1.2 and
verifies the file's sha256 before it ships.

```
https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_50m_coastline.geojson
```

Attribution, per their terms: *Made with Natural Earth. Free vector and
raster map data @ naturalearthdata.com.*

## Licence

MIT.

[ne]: https://www.naturalearthdata.com/
[spec]: https://github.com/mark-brannan/portolani/blob/main/docs/portolano-format.md
[pm]: https://github.com/mark-brannan/portolani/issues/25
[demo]: https://mark-brannan.github.io/coast-wright/
