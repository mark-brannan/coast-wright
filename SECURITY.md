# Security Policy

## Supported versions

This package is alpha and maintained as a single moving line. Only the latest
version published to npm gets fixes; there are no maintenance branches, and a
pre-1.0 release may change behaviour in a patch.

| Version | Supported |
| ------- | --------- |
| latest `0.0.x-alpha` on [npm](https://www.npmjs.com/package/coast-wright) | yes |
| anything older | no — upgrade first |

**Of the three packages in this family, this is the one that actually runs in
your process**, usually in a browser, so a version here matters more than a
version of the data packages. Pin an exact version, and read the release notes
before moving.

## Reporting a vulnerability

**Please do not open a public issue for a security problem.** Report it
privately through GitHub:

1. Go to
   [Security → Report a vulnerability](https://github.com/mark-brannan/coast-wright/security/advisories/new).
2. Describe what you found, which version you saw it in, and how to reproduce
   it. A portolano that triggers it — or the smallest fragment of one — is
   worth more than a description.

You should get an acknowledgement within a week. This is a spare-time project
maintained by one person, so a fix may take longer than that — you will be told
where it stands rather than left waiting. If a report is valid and you want
credit, you will be named in the advisory.

If you get no response at all within two weeks, open a public issue saying only
that you are waiting on a private report — no details — and it will be picked
up.

## What is in scope

**Treat the portolano as untrusted input.** A caller may well be drawing a
document fetched at runtime rather than one bundled at build time, and this
library is the code that touches it first.

- **Decoding.** `decodeRing` and everything under `lib/decode.js` parses
  attacker-controllable strings. A document that crashes the page, hangs it, or
  drives unbounded memory or CPU from a small input is in scope — including a
  point count or a `precision` that makes the work grow out of proportion to
  the bytes.
- **Drawing.** Anything in `limn` that lets document content escape into the
  page rather than staying inside the canvas: a value reaching a DOM API, a
  context property, or a style string.
- **The format check.** `rings` and `polygons` refuse a document whose `format`
  or coordinate order they do not recognise. A way past that check, so a
  document is drawn under assumptions it does not meet, is in scope.
- **The published tarball** — anything shipped in `files` that should not be
  there, or a discrepancy between npm and this repository at the corresponding
  tag.

## What is out of scope

- **Where the geometry came from.** Simplification, clipping and provenance
  belong to [portolani](https://github.com/mark-brannan/portolani/security);
  the published files belong to
  [coastlines](https://github.com/mark-brannan/coastlines/security).
- **The projection you supply.** `x` and `y` are your functions, called with
  your data. What they do is yours.
- **A coastline drawn in the wrong place** because `lonCenter` does not match
  your projection. That is a bug or a usage question — a public issue, and a
  welcome one, because it is the mistake this library exists to make harder.
- **Navigational use.** This draws coarse, deliberately lossy geometry for
  annotating a display. It is not a chart renderer and must not be used for
  pilotage.

## Notes on how this package is built

- **No runtime dependencies**, and no projection of its own. About 100 lines.
- `coastlines` is not bundled. It is a devDependency here so the tests run
  against real data; consumers supply their own geometry.
- `npm test` runs with the network unavailable, against fixtures and a mocked
  canvas context.
