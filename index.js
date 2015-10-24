const fs = require('fs');
const http = require('http');
const path = require('path');
const parseUrl = require('url').parse;
const querystring = require('querystring');

const httpStatus = require('http-status');
const mime = require('mime-types');
const rescape = require('escape-string-regexp');
const statik = require('node-static');

const CORS_HEADERS = {
	origin 		: 'Access-Control-Allow-Origin',
	headers 	: 'Access-Control-Allow-Headers'
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
		return stringResponse(status, 'text/html', html);
	},
	json: function(status, obj) {
		if (arguments.length === 1) {
			obj = status;
			status = 200;
		}
		return stringResponse(status, 'application/json', JSON.stringify(obj));
	},
	status: function(code, message) {
		return stringResponse(code, 'text/html', '<h1>' + code + ' ' + (message || httpStatus[code]) + '</h1>');
	},
	text: function(status, text) {
		if (arguments.length === 1) {
			text = status;
			status = 200;
		}
		return stringResponse(status, 'text/plain', text);
	}
};

function stringResponse(status, mimeType, str) {
	return [status, {'Content-Type': mimeType}, str];
}

function sendResponse(res, status, headers, body) {
	if (!('Content-Length' in headers)) {
		if (typeof body === 'string') {
			headers['Content-Length'] = Buffer.byteLength(body, 'utf8');
		} else if (typeof body.byteLength === 'function') {
			headers['Content-Length'] = body.byteLength();
		} else {
			return _handleResponse(responder.status(500));
		}
	}
	// for (var k in cors) {
	// 	headers[corsHeaders[k]] = cors[k];
	// }
	res.writeHead(status, headers);
	if (typeof body.pipe === 'function') {
		body.pipe(res);
	} else {
		res.end(body);
	}
}

function sendTextErrorResponse(res, status) {
	sendResponse(res, status, {'Content-Type': 'text/plain'}, httpStatus[status] || 'Error');
}

// TODO: add support for Regex named matches
// TODO: add support for Rails-style /:foo/:bar params
function makeSimpleRouter(routes) {
	function _matches(route, req) {
		if (route.path) {
			if (typeof route.path === 'string' && route.path !== req.uri.pathname) {
				return false;
			} else if (!req.uri.pathname.match(route.path)) {
				return false;
			}
		}
		if (req.method !== 'OPTIONS') {
			if (route.method && route.method.toUpperCase() !== req.method) {
				return false;
			}
		}
		return {};
	}

	return function(req) {
		for (var i = 0; i < routes.length; ++i) {
			var r = routes[i], m = _matches(r, req);
			if (m) {
				return [r, m];
			}
		}
		return null;
	}
}

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
						if (e) sendTextErrorResponse(res, e.status === 404 ? 404 : 500);
					});
			} else {
				_handleResponse(route.handler(req, matches, responder, res));
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
				}, function(err) {
					return _handleResponse(responder.status(500));
				});
			} else {
				return _sendResponse(response[0], response[1], response[2]);
			}
		}

		function _sendResponse(status, headers, body) {
			if (!('Content-Length' in headers)) {
				if (typeof body === 'string') {
					headers['Content-Length'] = Buffer.byteLength(body, 'utf8');
				} else if (typeof body.byteLength === 'function') {
					headers['Content-Length'] = body.byteLength();
				} else {
					return _handleResponse(responder.status(500));
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
