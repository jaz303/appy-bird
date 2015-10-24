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
		}
	]
}).listen(8080);