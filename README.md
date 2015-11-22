# appy-bird

`appy-bird` is a simple HTTP API server built for those situations where you need to throw up a quick system to handle dynamic requests, return HTML/JSON, and perhaps serve a bunch of static files. There's no templating engines or complicated middleware anywhere in sight - just a lightweight router and some sensible conventions for handling responses.

## Features

  * `rack`-style request handling; action handlers simply return `[status, headers, body]` triples...
  * ...or return a `Promise` if you need to do some async processing
  * simple built-in router, or bring your own by implementing a single-function interface
  * works with streams
  * static file/directory serving via `node-static`
  * CORS header support
  * pluggable body parsing, for non-JSON payloads
  * tiny codebase (~200 LOC + optional router component)

## Quick Start

    var server = require('appy-bird');

    server({
        routes: [
            {
                // serve a static file
                path: '/foo',
                file: __dirname + '/foo.txt'
            },
            {
                // serve static files from a directory
                path: /^\/assets[\/$]/,
                directory: __dirname + '/public'
            },
            {
                // regex path with matches being passed to the handler
                path: /^\/test-api\/(\d+)$/,
                handler: function(req, matches, r) {
                    return r.json([req.query, matches, Math.random()]);
                }
            },
            {
                // path matching with 
                path: '/greet/:title/:name',
                method: 'get',
                handler: function(req, matches, r) {
                    return r.text("hello " + matches.title + " " + matches.name);
                }
            }
        ]
    }).listen(8080);

## API

### Options

  * `cors`: object specifying CORS headers. Valid keys: `origin`, `exposeHeaders`, `maxAge`, `credentials`, `methods`, `headers`. If specified, CORS headers will be injected into every response. Support for `OPTIONS` requests is automatic.
  * `parseQuery`: function used to parse query string. Defaults to node's `querystring` module.
  * `routes`: array of routes. See Routing, below.
  * `route`: instead of supplying a route array you may use this option to supply your own routing function. See Routing, below.
  
### Routing

Routing is process of taking an HTTP request and selecting the correct handler to invoke. `appy-bird` provides a simple built-in router, or alternatively you can provide your own.

#### Using the built-in router

The built-in router represents routes as an array of objects; the first of these objects to match an incoming request "wins" and will be selected to handle it.

Valid keys to constrain those requests matched by a given route are:

  * `path`: a value that the request path must match; either a string or `RegExp`. String values may include colon-prefixed named segments (e.g. `/:controller/:action/:id`), which will be collected and passed to the handler's `matches` parameter.
  * `method`: string denoting required HTTP method

Route objects must also include one (and only one) of the following action keys to indicate what should happen when the route is matched:

  * `file`: absolute path of a static file to serve.
  * `directory`: absolute path of a static directory to serve. The request path will be appended.
  * `handler`: a handler function (see Handlers, below)

##### Examples

Static match, routed to handler function:

    {
      path: '/foobar',
      handler: function(req, matches, r, res) {
        // ...
      }
    }

Static match, routed to a static file:

    {
      path: '/photo.jpg',
      file: __dirname + '/image.jpg'
    }

Regexp match, routed to a static directory, accepting `GET` requests only:

    {
      path: /^\/assets[\/$]/,
      method: 'get',
      directory: __dirname + '/public'
    }

Regexp match, routed to a handler function. Within the handler, `matches` is an array containing the regex captures:

    {
      path: /^\/add\/(\d+)$/,
      handler: function(req, matches, response) {
        // ...
      }
    }

Dynamic match, routed to a handler function, `POST` requests only. Within the handler, `matches` is an object with `action` and `id` keys:

    {
      path: '/users/:action/:id',
      method: 'post',
      handler: function(req, matches, r, res) {
        // 
      }
    }

#### Using your own router

To use your own your own router, simply pass a function for the `route` option. This function will receive a `request` object (see Handler parameters, below) and should return either a route descriptor, or `null` if no matching route was found. A route descriptor is a 2-element array of `[route, matches]`, where `route` is an object containing one of the action keys described above , and `matches` represents any parameters that your router has extracted from the URL (or indeed from any other aspect of the request), such as Rails-style `/:path/:segments`. These will be passed as the second argument to the `handler` function.

### Handlers

Any route that does not resolve to a static directory or file must provide a route handler - a Javascript function to handle the request and return the reponse. Handlers have the signature:

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

#### `responder.file(absolutePath, [mimeType])`

Stream a file from the local filesystem. If `mimeType` is omitted it will be inferred from the filename.

#### `responder.html([status], html)`

Return an HTML page with optional `status`.

#### `responder.json([status], obj)`

Return a JSON representation of `obj` with optional `status`.

#### `responder.redirect(url)`

Redirect to `url`.

#### `responder.status(status, [message], [type])`

Returns `status` code. If `message` is omitted, the textual representation of `status` will be used.

`type`, if specified, may be one of:

  * `text` (default): response body is `message`
  * `html`: response body is `message` wrapped in an `&lt;h1&gt;` tag
  * `json`: response body is empty object

To specify `type` whilst retaining the default `message`, pass `null` for `message`.

#### `responder.string(status, mimeType, str)`

Returns a string response with a given MIME type.

#### `responder.text([status], text)`

Return a plain text response with optional `status`.