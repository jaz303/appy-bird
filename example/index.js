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
            path: /^\/test-api\/(\d+)$/,
            handler: function(req, matches, response) {
                return response.json([req.query, matches, Math.random()]);
            }
        },
        {
            path: '/foo/:bar/:baz',
            method: 'get',
            handler: function(req, matches, response) {
                return response.json(matches);
            }
        }
    ]
}).listen(8080);