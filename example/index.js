var appy = require('../');

appy({
	routes: [
		{
			path: '/foo',
			file: __dirname + '/foo.txt'
		},
		{
			path: /^\/assets[\/$]/,
			directory: __dirname + '/public'
		},
		{
			path: '/test-api',
			handler: function(req, matches, response) {
				return response.json([1,2,3,4,5, Math.random(), matches]);
			}
		}
	]
}).listen(8080);