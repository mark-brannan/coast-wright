# Agent decisions

Append-only. Each entry is a call an agent made in pencil: a default it took
under the one-way-door test, with its undo. Written by `agent-decision`; the
heading is the UTC stamp, so `agent_decisions.md#<stamp>` links one entry.

### 20261011t013858z
- Demo site budget raised from 1.8 MB to 5.2 MB to hold four optional Natural Earth layers Undo: drop the layers and restore BUDGET = 1_800_000 ([#26](https://github.com/mark-brannan/coast-wright/pull/26))

### 20261011t013901z
- Demo layers: 1:50m borders, rivers, lakes, ice shelves; borders and generated graticule on by default Undo: edit the layers table in demo/demo.js ([#26](https://github.com/mark-brannan/coast-wright/pull/26))

### 20261011t013903z
- Demo opens on Winkel tripel; gallery.svg kept as favicon only, README image is a demo screenshot Undo: revert README image line and the default spec id ([#26](https://github.com/mark-brannan/coast-wright/pull/26))

### 20261014t184230z
- fill/trace find the horizon from the visible predicate alone, no explicit cap option Undo: add an explicit horizon option ([#35](https://github.com/mark-brannan/coast-wright/pull/35))

### 20261014t184233z
- trace throws when visible's horizon cannot be followed Undo: close each visible run with a straight line instead ([#35](https://github.com/mark-brannan/coast-wright/pull/35))

### 20261014t184236z
- with visible set, split edges longer than 1 degree before clipping Undo: drop densify in lib/fill.js ([#35](https://github.com/mark-brannan/coast-wright/pull/35))

### 20261014t193637z
- visible must refuse a region lying across the seam; land wholly round a refused region off the seam is filled whole rather than searched for Undo: find a refused point by searching the sphere when no ring crosses, and add the horizon as a hole ([#35](https://github.com/mark-brannan/coast-wright/pull/35#discussion_r4275377452)) ([#35](https://github.com/mark-brannan/coast-wright/pull/35))

### 20261014t210452z
- Format CI job fetches prettier with npx at the version package.json pins, not npm ci (no lockfile tracked) Undo: switch the format job to npm ci once a lockfile lands ([#31](https://github.com/mark-brannan/coast-wright/pull/31))
