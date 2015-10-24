const fs = require('fs');
const http = require('http');
const httpStatus = require('http-status');
const mime = require('mime-types');
const parseUrl = require('url').parse;
const Promise = require('es6-promise').Promise;
const rescape = require('escape-string-regexp');

const corsHeaders = {
	origin 		: 'Access-Control-Allow-Origin',
	headers 	: 'Access-Control-Allow-Headers'
};

function stringResponse(status, mimeType, str) {
	return [status, {'Content-Type': mimeType}, str];
}

function fileResponse(file) {
	return new Promise(function(resolve, reject) {
		fs.stat(file, function(err, stat) {
			if (err) return reject(err); // TODO: should return 404 on ENOENT
			return resolve([200, {
				'Content-Type': mime.lookup(file) || 'application/octet-stream',
				'Content-Length': stat.size
			}, fs.createReadStream(file)]);
		}); 
	});
}

function attachFileHandler(route) {
	route.handler = function(req, res) {
		return fileResponse(route.file);
	}
}

function attachDirectoryHandler(route) {
	const localDirectory = route.directory;
	const directoryPath = route.path;
	if (typeof directoryPath !== 'string') {
		throw new Error("directory handler path must be a string");
	}
	route.path = new RegExp("^" + rescape(route.path));
	route.handler = function(req, res) {
		// TODO: sanitisation
		const filePath = localDirectory + req.uri.pathname.substring(directoryPath.length);
		return fileResponse(filePath);
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
			return _handleResponse(route.handler(req, responder));
		});

		function _handleResponse(response) {
			if (response === true) {
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