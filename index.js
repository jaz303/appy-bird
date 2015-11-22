const fs = require('fs');
const http = require('http');
const path = require('path');
const parseUrl = require('url').parse;
const querystring = require('querystring');

const httpStatus = require('http-status');
const mime = require('mime-types');
const statik = require('node-static');

const makeSimpleRouter = require('./lib/simple-router');

const CORS_HEADERS = {
    origin          : 'Access-Control-Allow-Origin',
    exposeHeaders   : 'Access-Control-Expose-Headers',
    maxAge          : 'Access-Control-Max-Age',
    credentials     : 'Access-Control-Allow-Credentials',
    methods         : 'Access-Control-Allow-Methods',
    headers         : 'Access-Control-Allow-Headers',
};

const BODY_HANDLERS = {
    'application/json': {
        read: 'string',
        filter: function(body) { return JSON.parse(body); }
    }
};

module.exports = appy;
module.exports.registerBodyHandler = registerBodyHandler;

function readBody(handler, req, cb) {
    var reader = (handler.read === 'string') ? readStringBody : readBufferBody;
    reader(req, function(body) {
        try {
            var parsedBody = handler.filter(body);
        } catch (e) {
            return cb(e);
        }
        cb(null, parsedBody);
    });
}

function readStringBody(req, cb) {
    var body = '';
    req.setEncoding('utf8');
    req.on('data', function(chunk) { body += chunk; });
    req.on('end', function() { cb(body); });
}

function readBufferBody(req, cb) {
    var bufs = [];
    req.on('data', function(chunk) { bufs.push(chunk); });
    req.on('end', function() { cb(Buffer.concat(bufs)); });
}

var responder = {
    html: function(status, html) {
        if (arguments.length === 1) {
            html = status;
            status = 200;
        }
        return responder.string(status, 'text/html', html);
    },
    json: function(status, obj) {
        if (arguments.length === 1) {
            obj = status;
            status = 200;
        }
        return responder.string(status, 'application/json', JSON.stringify(obj));
    },
    redirect: function(url) {
        return [302, {'Location': url}, ''];
    },
    status: function(status, message, type) {
        message = status + ' ' + (message || httpStatus[status]);
        switch (type || 'text') {
            case 'html': return responder.html(status, '<h1>' + message + '</h1>');
            case 'json': return responder.json(status, {});
            case 'text': return responder.text(status, message);
            default: throw new Error("unknown response type: " + type);
        }
    },
    string: function(status, mimeType, str) {
        return [status, {'Content-Type': mimeType}, str];
    },
    text: function(status, text) {
        if (arguments.length === 1) {
            text = status;
            status = 200;
        }
        return responder.string(status, 'text/plain', text);
    }
};

function registerBodyHandler(contentType, read, handler) {
    BODY_HANDLERS[contentType] = { read: read, handler: handler };
}

function appy(opts) {

    var cors = opts.cors || {};
    var route = opts.route || makeSimpleRouter(opts.routes || []);
    var parseQuery = opts.parseQuery || querystring.parse;
    var fileServers = {};

    return http.createServer(function(req, res) {

        req.uri = parseUrl(req.url);
        req.query = req.uri.query ? parseQuery(req.uri.query) : {};
        
        var match = route(req);
        if (!match) {
            return _handleResponse(responder.status(404));
        }

        if (req.method === 'OPTIONS') {
            return _sendResponse(200, {
                'Content-Type': 'text/plain',
                'Content-Length': 0
            }, '');
        }

        var bodyHandler = BODY_HANDLERS[req.headers['content-type']];
        if (bodyHandler) {
            readBody(bodyHandler, req, function(err, parsedBody) {
                if (err) {
                    return _handleResponse(responder.status(400));
                }
                req.body = parsedBody;
                _dispatch(match[0], match[1]);
            });
        } else {
            _dispatch(match[0], match[1]);
        }

        function _dispatch(route, matches) {
            if (route.file) {
                _fileServer(path.dirname(route.file))
                    .serveFile('./' + path.basename(route.file), 200, {}, req, res);
            } else if (route.directory) {
                _fileServer(route.directory)
                    .serve(req, res, function(e) {
                        if (e) {
                            _handleResponse(responder.status(e.status === 404 ? 404 : 500));
                        }
                    });
            } else {
                try {
                    _handleResponse(route.handler(req, matches, responder, res));
                } catch (e) {
                    _handleError(e);
                }
            }
        }

        function _handleResponse(response) {
            if (response === void 0) {
                // do nothing; undefined means handler has taken responsibility
            } else if (response === true) {
                return _handleResponse(responder.status(200));
            } else if (response === false) {
                return _handleResponse(responder.status(500));
            } else if (typeof response.then === 'function') {
                response.then(function(res) {
                    return _handleResponse(res);
                }, _handleError);
            } else {
                return _sendResponse(response[0], response[1], response[2]);
            }
        }

        function _handleError(e) {
            if (typeof e === 'number') e = { status: e };
            _handleResponse(responder.status(e.status || 500));
        }

        function _sendResponse(status, headers, body) {
            if (!('Content-Length' in headers)) {
                if (typeof body === 'string') {
                    headers['Content-Length'] = Buffer.byteLength(body, 'utf8');
                } else if (typeof body.byteLength === 'function') {
                    headers['Content-Length'] = body.byteLength();
                }
            }
            for (var k in cors) {
                headers[CORS_HEADERS[k]] = cors[k];
            }
            res.writeHead(status, headers);
            if (typeof body.pipe === 'function') {
                body.pipe(res);
            } else {
                res.end(body);
            }
        }

    });

    function _fileServer(directory) {
        var srv = fileServers[directory];
        if (!srv) {
            srv = fileServers[directory] = new statik.Server(directory);
        }
        return srv;
    }

}
