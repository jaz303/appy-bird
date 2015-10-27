# appy-bird

`appy-bird` is built for those situations where you need to throw up a quick server to handle dynamic requests, and maybe serve a bunch of static files. No templating engines, no complicated middleware.

## Features

  * `rack`-style request handling; action handlers simply return `[status, headers, body]` triples...
  * ...or return a `Promise` if you need to do some async processing
  * simple built-in router, or bring your own by implementing a single-function interface
  * works with streams
  * static file/directory serving via `node-static`
  * CORS header support
  * pluggable body parsing, for non-JSON payloads
  * tiny codebase (~200 LOC + optional router component)

## API

### Options