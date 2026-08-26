## What and why

<!--
Motivation and approach, not mechanics — the diff shows what changed. If this
closes an issue, say so here: closes #12
-->

## Does this touch the seam or the projection?

<!--
REQUIRED. These are the two bugs the library exists to prevent, and both look
fine in a screenshot.

If it touches the seam guard, say which `lonCenter` values the new test
exercises. A Greenwich-centred map hides exactly what goes wrong at sea, so a
test at lonCenter 0 alone does not count. A change that tests segments against
the dateline rather than against `lonCenter` will be rejected.

If it touches projection handling: this library takes `x` and `y` and assumes
nothing else, including over a pole. Say how that still holds.

Write "no" if neither is involved.
-->

## Version

- [ ] patch (no change to what gets stroked for an unchanged document)
- [ ] minor (new option or export, or the drawn result moved — say so above)
- [ ] major / breaking (an export removed, or acceptance narrowed)

## Checks

- [ ] `npm test` passes, with the network unavailable
- [ ] Tests assert geometry — which segments were stroked, where a path broke — not pixels
- [ ] Still no runtime dependencies, and still no projection of its own
- [ ] Nothing new moved into the per-frame redraw path (`rings` stays cached per document)
- [ ] `precision` still comes from the document, never a constant
- [ ] Branched from latest `main` (rebased, not merged)
- [ ] One logical change

## Anything the maintainer should look at

<!--
A document shape you made this newly tolerant of and why refusing was worse, or
a rendering trade-off. Delete if there is nothing.
-->
