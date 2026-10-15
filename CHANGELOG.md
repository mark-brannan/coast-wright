# Changelog

## [0.0.5-alpha.1](https://github.com/mark-brannan/coast-wright/compare/v0.0.4-alpha.1...v0.0.5-alpha.1) (2026-10-15)


### Added

* **api:** centralMeridian, boundingBox, lineCap, withinCap and one project([lon, lat]) ([#47](https://github.com/mark-brannan/coast-wright/issues/47)) ([7afbe4d](https://github.com/mark-brannan/coast-wright/commit/7afbe4d2eef9291ca60fda6f686afa5e659f40f3))
* **cap:** a predicate for the points within an angle of a centre ([#44](https://github.com/mark-brannan/coast-wright/issues/44)) ([9da243b](https://github.com/mark-brannan/coast-wright/commit/9da243bb40608aa809b25eec8f3cf8372ab152ee))
* **limn:** lonCenter: null turns the longitude-seam rule off ([#46](https://github.com/mark-brannan/coast-wright/issues/46)) ([cb05b90](https://github.com/mark-brannan/coast-wright/commit/cb05b9092950302a2587fdc85a15791780cc6eeb))

## [0.0.4-alpha.1](https://github.com/mark-brannan/coast-wright/compare/v0.0.3-alpha.1...v0.0.4-alpha.1) (2026-10-15)


### Added

* **letter:** a point's name takes a shore and runs perpendicular to it ([#38](https://github.com/mark-brannan/coast-wright/issues/38)) ([98d235e](https://github.com/mark-brannan/coast-wright/commit/98d235eb75b30b20deeb71410cf63ebf8b00999f))
* **limn:** accept an async iterable of rings, drawing pieces as they arrive ([#40](https://github.com/mark-brannan/coast-wright/issues/40)) ([1249372](https://github.com/mark-brannan/coast-wright/commit/12493726b1940fa5e9f0b99e63b20fe3b636f05e))

## [0.0.3-alpha.1](https://github.com/mark-brannan/coast-wright/compare/v0.0.2-alpha.1...v0.0.3-alpha.1) (2026-10-14)


### Added

* fill land, keep a stroke on it, and draw rhumb lines ([#32](https://github.com/mark-brannan/coast-wright/issues/32)) ([0a9d191](https://github.com/mark-brannan/coast-wright/commit/0a9d191862670468ccc04c1003e9e8174d0465dd))
* **fill:** cut land at the horizon with visible ([#35](https://github.com/mark-brannan/coast-wright/issues/35)) ([69ab19f](https://github.com/mark-brannan/coast-wright/commit/69ab19f4090e9291998d42f072ba6882d90904f4))
* **hand:** hand-drawn line and area treatments for rivers and lakes ([#36](https://github.com/mark-brannan/coast-wright/issues/36)) ([1e1f601](https://github.com/mark-brannan/coast-wright/commit/1e1f601330c80d5c9fbad94d2ab771f568ee439d))


### Fixed

* **ci:** hold publish on npm 11, not latest ([#29](https://github.com/mark-brannan/coast-wright/issues/29)) ([4cc602b](https://github.com/mark-brannan/coast-wright/commit/4cc602b7f8ce82aa405bac698b06dfc97e864325))

## [0.0.2-alpha.1](https://github.com/mark-brannan/coast-wright/compare/v0.0.1-alpha.1...v0.0.2-alpha.1) (2026-10-11)


### Added

* draw GeoJSON rings without a decoder ([#22](https://github.com/mark-brannan/coast-wright/issues/22)) ([8e63d2c](https://github.com/mark-brannan/coast-wright/commit/8e63d2cf2214c7205c2a5108dedaca3c35fcf6a2))


### Fixed

* **package:** drop the dead peerDependenciesMeta ([#21](https://github.com/mark-brannan/coast-wright/issues/21)) ([b8af718](https://github.com/mark-brannan/coast-wright/commit/b8af7181a2fd7022f763b381ef1250adb0270a45)), closes [#3](https://github.com/mark-brannan/coast-wright/issues/3)
