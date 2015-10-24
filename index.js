const fs = require('fs');
const http = require('http');
const httpStatus = require('http-status');
const mime = require('mime-types');
const path = require('path');
const parseUrl = require('url').parse;
const Promise = require('es6-promise').Promise;
const rescape = require('escape-string-regexp');
const statik = require('node-static');

const corsHeaders = {
	origin 		: 'Access-Control-Allow-Origin',
	headers 	: 'Access-Control-Allow-Headers'
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

function attachFileHandler(route) {
	var server = new statik.Server(path.dirname(route.file));
	var file = './' + path.basename(route.file);
	route.handler = function(req, _1, _2, res) {
		server.serveFile(file, 200, {}, req, res);
	}
}

function attachDirectoryHandler(route) {
	var server = new statik.Server(route.directory);
	route.handler = function(req, _1, _2, res) {
		server.serve(req, res, function(e, _3) {
			if (e) {
				sendTextErrorResponse(res, e.status === 404 ? 404 : 500);
			}
		});
	}
}

module.exports = function(opts) {

	var routes = opts.routes;
	var cors = opts.cors || {};

	routes.forEach(function(r) {
		if (r.file) {
			attachFileHandler(r);
		} else if (r.directory) {
			attachDirectoryHandler(r);
		}
	});

	function routeMatches(route, request) {
		if (route.path) {
			if (typeof route.path === 'string' && route.path !== request.uri.pathname) {
				return false;
			} else if (!request.uri.pathname.match(route.path)) {
				return false;
			}
		}
		if (request.method !== 'OPTIONS') {
			if (route.method && route.method.toUpperCase() !== request.method) {
				return false;
			}	
		}
		return true;
	}

	function findRoute(request) {
		for (var i = 0; i < routes.length; ++i) {
			if (routeMatches(routes[i], request)) {
				return routes[i];
			}
		}
		return null;
	}

	var server = http.createServer(function(req, res) {

		// TODO: 
		req.uri = parseUrl(req.url);

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
			}
		};

		var route = findRoute(req);
		if (!route) {
			return _handleResponse(responder.status(404));
		}

		if (req.method === 'OPTIONS') {
			return _sendResponse(200, {
				'Content-Type': 'text/plain',
				'Content-Length': 0
			}, '');
		}

		// TODO: need to do smart body parsing...
		var body = '';
		req.setEncoding('utf8');
		req.on('data', function(chunk) { body += chunk; });
		req.on('end', function() {
			if (req.headers['content-type'] === 'application/json') {
				try {
					body = JSON.parse(body);	
				} catch (e) {
					return _handleResponse(responder.status(400));
				}
			}
			req.body = body;
			return _handleResponse(route.handler(req, null, responder, res));
		});

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
				headers[corsHeaders[k]] = cors[k];
			}
			res.writeHead(status, headers);
			if (typeof body.pipe === 'function') {
				body.pipe(res);
			} else {
				res.end(body);
			}
		}

	});

	return server;

}