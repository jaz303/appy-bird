# appy-bird

`appy-bird` is built for those situations where you need to throw up a quick server to handle dynamic requests, return HTML/JSON, and maybe serve a bunch of static files. No templating engines, no complicated middleware.

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

  * `cors`: 
  * `parseQuery`: function used to parse query string. Defaults to node's `querystring` module.
  * `route`:
  * `routes`:

### Handlers

Handlers have the signature:

```javascript
function(request, matches, responder, response) {}
```

Parameters:

  * `request`: the standard node HTTP request object, with some additions:
    * `request.uri`: the parsed request URL (i.e. `url.parse(request.url)`).
    * `request.query`: the parsed query string, as returned by the `parseQuery` server setting.
    * `request.body`: the parsed request body, if there is a registered body handler for the request's content type.
  * `matches`: any additional parameters returned by the router, typically matched URL segments, but router-dependent.
  * `responder`: helper object for generating response arrays, see Responder, below.
  * `response`: node HTTP response object. Use this to handle responses manually.

Handlers may return:

  * `[status, headers, body]`: standard response format. `headers` is an object, and `body` can be a buffer, string, or readable stream. If omitted, a `Content-Length` header will be automatically inserted if `body` is a string or buffer. CORS headers, if configured, will be injected automatically.
  * `boolean`: return status 200 (`true`) or 500 (`false`).
  * `Promise`: if handler is asynchronous, return a `Promise` that resolves to any of the above.
  * `undefined`: return `undefined` to indicate that the handler is taking responsibility for the request and no further response processing is required.

#### Error Handling

If a handler function throws an error, or a handler's `Promise` is rejected, the following will occur:

  * if the error is a number, this will be used as the response status code.
  * if the error has a `status` property, its value will be used as the response status code.
  * otherwise, a 500 status is used.

Errors are sent with content type `text/plain`.

### Responder

The responder is a helper object, passed to your handler functions, that can be used to generate correctly formatted response triples.

#### `responder.html([status], html)`

Return an HTML page with optional `status`.

#### `responder.json([status], obj)`

Return a JSON representation of `obj` with optional `status`.

#### `responder.status(status, [message], [type])`

Returns `status` code. If `message` is omitted, the textual representation of `status` will be used.

`type`, if specified, may be one of:

  * `text` (default): response body is `message`
  * `html`: response body is `message` wrapped in &lt;1&gt; tags
  * `json`: response body is empty object

To specify `type` whilst retaining the default `message`, pass `null` for `message`.

#### `responder.string(status, mimeType, str)`

Returns a string response with a given MIME type.

#### `responder.text([status], text)`

Return a plain text response with optional `status`.