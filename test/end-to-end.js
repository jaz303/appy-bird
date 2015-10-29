var appy = require('../');
var test = require('tape');
var http = require('http');

var PORT = 27123;

function createServer(opts) {
	var srv = appy(opts);
	srv.listen(PORT, "127.0.0.1");
	return srv;
}

test("foo", function(assert) {
	var server = createServer({
		routes: [
			{
				path: '/foo',
				handler: function(req, matches, r, res) {
					return r.text(201, "hello");
				}
			}
		]
	});

	http.get("http://localhost:" + PORT + "/foo", function(res) {
		assert.equals(res.statusCode, 201);
		var body = '';
		res.setEncoding('utf8');
		res.on('data', function(str) { body += str; });
		res.on('end', function() {
			assert.equals(body, 'hello');
			server.close(function() {
				assert.end();
			});
		});
	});
});
