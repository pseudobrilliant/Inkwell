# Fetch link titles

- **Status:** open
- **Likely capabilities:** capture, resources
- **ADRs:** None yet.

## Why

A captured URL is saved without a title, so the writer has to name it by hand later.

## What could change

Fetch the page title when a URL is captured, to fill an empty title.

## Out of scope / constraints

Needs `requestUrl`, a network call. Capture works offline today and must keep working offline: fetching can only ever be a later, optional improvement.
