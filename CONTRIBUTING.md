# Contributing

Thanks for looking. coast-wright decodes and draws
[portolani][spec] — compact coastline geometry — onto a canvas, through
whatever projection you already have. About 100 lines, no dependencies, no
projection of its own.

> **This package is alpha.** The code is lifted from a shipping plugin and its
> tests came with it, but the format it reads is still settling. See
> [the spec's change policy][changes].

## Which repository

- **[portolani](https://github.com/mark-brannan/portolani)** generates the
  geometry and owns the format.
- **[coastlines](https://github.com/mark-brannan/coastlines)** publishes
  ready-made files.
- **This repository** turns those files into strokes on a canvas.

**If the JSON is right and the picture is wrong, it is ours.** If the shape is
wrong in the data itself, it is portolani's. When in doubt, file it here; it
will be moved.

## The two bugs this library exists to prevent

Both are the kind that look fine in a screenshot and fail at sea, and both are
worth understanding before changing anything in `limn.js`:

**The seam.** A ring crossing the antimeridian holds two points a tenth of a
degree apart on the ground and 360 apart in the numbers. Joined, they lay a
line straight across the map. So does a ring passing behind a window centred
anywhere but Greenwich — which is why each segment is tested against
`lonCenter`, the longitude the projection measures from, rather than against
the dateline. **A dateline-only guard looks correct until somebody centres the
map on their own boat**, so a change that reintroduces one will be rejected on
sight.

**The projection.** `limn` takes your `x` and `y` and assumes nothing else, so
it works over a pole. Nothing in here may acquire a projection, a coordinate
system, or an opinion about zoom. The reason people hand-roll coastline
drawing is that every library brought its own Web Mercator, and Mercator cannot
show a pole.

A change touching either of these needs a test that fails without it. There are
existing seam tests to copy the shape of.

## Refusing beats drawing something wrong

`rings` and `polygons` reject a document whose `format` or coordinate order
they do not recognise. That is deliberate: a plausible-looking coastline in the
wrong place is worse than a blank canvas, because nobody investigates a map
that looks fine.

Keep it. New tolerance for an unknown document shape needs an argument, not
just a fallback.

## Setting up

```shell
git clone https://github.com/mark-brannan/coast-wright.git
cd coast-wright
npm install
npm test
```

Node 20 or newer. No runtime dependencies. `coastlines` is a devDependency
here so the tests have real data; it is deliberately not bundled, so consumers
choose their own fidelity rather than being handed one.

## Before you open a pull request

```shell
npm test
```

Then:

- **Tests assert geometry, not pixels** — which segments were stroked, where a
  path broke, what a decode produced. Canvas output is mocked; a test that
  needs a real browser is a test that does not run.
- **A seam or projection change comes with a case that fails without it**, and
  says which `lonCenter` it exercises. Greenwich-centred is the case that hides
  bugs.
- **No dependencies, and no projection.** Both are the point of the library.
- **Watch the redraw path.** `rings` is decoded once per document and cached
  because a map redraws on resize; work moved into the per-frame path is a
  regression even when the picture is identical.
- **`precision` comes from the document**, never from a constant. Profiles
  differ.
- **Branch from latest `main`**, and rebase onto it rather than merging it in.
- **One logical change per pull request.**
- **Commits are conventional**: `<type>(<scope>): <subject>`, imperative,
  50 characters or fewer.

## Versions

Pre-1.0 and alpha, so the interface can still move:

- A new option, a new export, or a newly accepted `format` value is a minor.
- A change to what gets stroked for an unchanged document and unchanged
  projection is a minor at least — say so, because somebody's map moves.
- Removing an export or narrowing what is accepted is a major once this reaches
  1.0. Before then, say so loudly.

## Code of Conduct

Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Licence

Contributions are licensed under the [MIT licence](LICENSE) that covers this
project.

[spec]: https://github.com/mark-brannan/portolani/blob/main/docs/portolano-format.md
[changes]: https://github.com/mark-brannan/portolani/blob/main/docs/portolano-format.md#8-changes
