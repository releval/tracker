# Contributing

Thanks for taking the time. Bug reports, reproductions and pull requests are all
welcome.

## Before you start

For anything larger than a fix, open an issue first and describe what you want to
change. That saves you writing code that does not fit where the library is going.

[DEVELOPING.md](DEVELOPING.md) covers the project layout, the commands, and how
the pieces fit together. Read that first.

## Working on a change

Branch names use a prefix: `feature/`, `fix/`, `chore/` or `docs/`.

From `src/tracker/`, these all have to pass:

```bash
npm test
npm run typecheck
npm run lint
npm run docs:check
npm run build
```

From the repository root:

```bash
npm run test:e2e
```

`npm run test:integration` also exists. It boots a real Releval server, Postgres
and ClickHouse under Testcontainers and asserts that events land, which means it
pulls a ~1.3 GB image and needs a working Docker daemon. CI runs it on `main`
and on releases, not on pull requests from forks, so you are not expected to run
it locally. If you change the wire contract, please do.

Public API changes need TSDoc; `npm run docs:check` fails the build without it.

## Commits and pull requests

Write commit subjects in sentence case, in the imperative: "Add the ordinal to
impressions", not "added" or "adds".

Keep a pull request to one idea. Say what changed and why in the description; if
the change is behavioural, say what a consumer would notice.

## Reporting bugs

Open an issue with the tracker version, the browser, and the smallest page or
snippet that reproduces the problem. Events the tracker sends are visible in the
network tab, and `debug: true` in the tracker options logs the pipeline, so a
copy of that output usually says more than a description does.

Security problems go through [SECURITY.md](SECURITY.md) instead, not the issue
tracker.

## Licence

By contributing you agree that your contribution is licensed under the
[Apache License 2.0](LICENSE), the same as the rest of the project.
