var appy = require('../');
var test = require('tape');
var http = require('http');

var NEXT_PORT = 27123;

function createServer(port, opts) {
	var srv = appy(opts);
	srv.listen(port, "127.0.0.1");
	return srv;
}

function one(name, handler, cb, opts) {

	var port = NEXT_PORT++;
	opts = opts || {};

	var server = createServer(port, {
		routes: [
			{
				path: '/test',
				handler: handler
			},
			{
				path: '/test-file',
				file: __dirname + '/static/files/test.txt'
			},
			{
				path: /^\/files[\/$]/,
				directory: __dirname + '/static'
			}
		]
	});

	test(name, function(assert) {
		var req = http.request({
			method: opts.method || 'get',
			port: port,
			path: (opts.path || '/test'),
			headers: opts.headers || {},
		}, function(res) {
			var body = '';
			res.setEncoding('utf8');
			res.on('data', function(str) { body += str; });
			res.on('end', function() {
				server.close(function() {
					cb(assert, res, body);
					assert.end();
				});
			});
		});

		if (opts.body) {
			req.write(opts.body);
		}

		req.end();
	});
	
}

one("success response",
	function(req, matches, r, res) {
		return true;
	},
	function(assert, res, body) {
		assert.equals(res.statusCode, 200);
		assert.equals(res.headers['content-type'], 'text/plain');
		assert.equals(res.headers['content-length'], '' + body.length);
		assert.equals(body, '200 OK');
	}
);

one("failure response",
	function(req, matches, r, res) {
		return false;
	},
	function(assert, res, body) {
		assert.equals(res.statusCode, 500);
		assert.equals(res.headers['content-type'], 'text/plain');
		assert.equals(res.headers['content-length'], '' + body.length);
		assert.equals(body, '500 Internal Server Error');
	}
);

one("text response",
	function(req, matches, r, res) {
		return r.text(201, "hello");
	},
	function(assert, res, body) {
		assert.equals(res.statusCode, 201);
		assert.equals(res.headers['content-type'], 'text/plain');
		assert.equals(res.headers['content-length'], '' + body.length);
		assert.equals(body, 'hello');
	}
);

one("JSON response",
	function(req, matches, r, res) {
		return r.json(404, [1,2,3,4]);
	},
	function(assert, res, body) {
		assert.equals(res.statusCode, 404);
		assert.equals(res.headers['content-type'], 'application/json');
		assert.equals(res.headers['content-length'], '' + body.length);
		assert.deepEquals(JSON.parse(body), [1,2,3,4]);
	}
);

one("HTML response",
	function(req, matches, r, res) {
		return r.html(402, "<h1>hello world</h1>");
	},
	function(assert, res, body) {
		assert.equals(res.statusCode, 402);
		assert.equals(res.headers['content-type'], 'text/html');
		assert.equals(res.headers['content-length'], '' + body.length);
		assert.equals(body, "<h1>hello world</h1>");
	}
);

one("async processing - OK",
	function(req, matches, r, res) {
		return new Promise(function(resolve, reject) {
			setTimeout(function() {
				resolve(r.text('worth waiting for'));
			}, 100);
		});
	},
	function(assert, res, body) {
		assert.equals(res.statusCode, 200);
		assert.equals(res.headers['content-type'], 'text/plain');
		assert.equals(res.headers['content-length'], '' + body.length);
		assert.equals(body, "worth waiting for");
	}
);

one("async processing - numeric status",
	function(req, matches, r, res) {
		return new Promise(function(resolve, reject) {
			setTimeout(function() { reject(401); }, 100);
		});
	},
	function(assert, res, body) {
		assert.equals(res.statusCode, 401);
	}
);

one("async processing - error status",
	function(req, matches, r, res) {
		return new Promise(function(resolve, reject) {
			setTimeout(function() { reject(401); }, 100);
		});
	},
	function(assert, res, body) {
		assert.equals(res.statusCode, 401);
	}
);

one("async processing - error object with status",
	function(req, matches, r, res) {
		return new Promise(function(resolve, reject) {
			var err = new Error();
			err.status = 402;
			setTimeout(function() { reject(err); }, 100);
		});
	},
	function(assert, res, body) {
		assert.equals(res.statusCode, 402);
	}
);

one("async processing - error object without status",
	function(req, matches, r, res) {
		return new Promise(function(resolve, reject) {
			setTimeout(function() { reject(new Error); }, 100);
		});
	},
	function(assert, res, body) {
		assert.equals(res.statusCode, 500);
	}
);

one("static file",
	null,
	function(assert, res, body) {
		assert.equals(res.headers['content-type'], 'text/plain');
		assert.equals(body, 'test file');
	},
	{
		path: '/test-file'
	}
);

one("static directory",
	null,
	function(assert, res, body) {
		assert.equals(res.headers['content-type'], 'text/plain');
		assert.equals(body, 'test file');
	},
	{
		path: '/files/test.txt'
	}
);

one("not found",
	null,
	function(assert, res, body) {
		assert.equals(res.statusCode, 404);
	},
	{
		path: '/something-else'
	}
);

one("body parsing (JSON)",
	function(req, matches, r, res) {
		var v = req.body.map(function(v) { return v + 1; });
		return r.json(v);
	},
	function(assert, res, body) {
		assert.deepEquals(JSON.parse(body), [2,3,4,5]);
	},
	{
		method: 'post',
		body: '[1,2,3,4]',
		headers: {
			'Content-Type': 'application/json'
		}
	}
);

