# Backend Ticket: OpenAlex Metadata Proxy

## Priority

Required before the Researcher submission form can offer an OpenAlex scan.

## Required endpoint

`GET /api/OpenAlex/works/{workId}`

The endpoint must accept only a canonical `W`-prefixed work ID, perform the
OpenAlex request server-side, and return a normalized preview containing title,
abstract/inverted-index summary, publication date, DOI, authors, institutions,
concepts/topics, and source identifiers.

## Required behavior

- Authenticate the requester and apply request rate limiting and caching.
- Do not expose an OpenAlex API key to the browser.
- Validate the work ID and reject arbitrary URLs, DOIs, and proxy targets.
- Return explicit `404`, rate-limit, upstream-timeout, and unavailable errors.
- Record the lookup actor, work ID, timestamp, and outcome without logging
  credentials or private manuscript content.
- Keep imported metadata as a preview only; attaching it to a manuscript must
  remain an explicit researcher confirmation action.
