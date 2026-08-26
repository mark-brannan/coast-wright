Copies of three files from the `coastlines` package, vendored so that
`npm test` needs no install and no network.

They are not edited here. `test/limn.test.mjs` checks each against the
`digest` it carries, so a stale copy fails rather than passes quietly.
Refresh with:

    cp node_modules/coastlines/data/coastline-110m.json \
       node_modules/coastlines/data/land-110m.json \
       node_modules/coastlines/fixtures/portolano-fixtures.json \
       test/fixtures/
