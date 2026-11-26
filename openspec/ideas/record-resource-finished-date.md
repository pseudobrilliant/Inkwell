# Record when a resource is finished

- **Status:** open
- **Likely capabilities:** resources, contribution
- **ADRs:** None yet.

## Why

Finishing a resource records no date, so "read this month" can't be counted. The same gap as finishing a piece (see [writing-life-view](writing-life-view.md)).

## What could change

Record when a resource reaches `status: done` (for example a `finished` date), and count resources finished per period in `inkwell-contribution`.

## Out of scope / constraints

Older resources marked done have no date. Decide whether they count, and under which period.
