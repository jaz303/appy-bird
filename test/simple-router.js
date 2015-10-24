var router = require('../lib/simple-router');
var test = require('tape');

function testRoute(assert, route, cases) {
    var r = router([route]);
    for (var method in cases) {
        for (var path in cases[method]) {
            var expect = cases[method][path];
            var result = r({
                method: method,
                uri: {
                    pathname: path
                }
            });
            if (expect === true) {
                assert.ok(result);
            } else if (expect === false) {
                assert.notOk(result);
            } else {
                if (Array.isArray(expect)) {
                    assert.equal(expect.length, result[1].length);
                    expect.forEach(function(x, ix) {
                        assert.equal(x, result[1][ix]);
                    }); 
                } else {
                    assert.deepEqual(expect, result[1]);
                }
            }
        }
    }
}

test("string match", function(assert) {
    testRoute(assert, { path: '/foo' }, {
        GET: {
            '/foo': true,
            '/foo/': false,
            '/bar': false
        },
        POST: {
            '/foo': true,
            '/foo/': false,
            '/bar': false
        }
    });
    assert.end();
});

test("method match", function(assert) {
    testRoute(assert, { path: '/foo', method: 'get' }, {
        GET: {
            '/foo': true,
        },
        POST: {
            '/foo': false
        }
    });
    assert.end();
});

test("regexp match", function(assert) {
    testRoute(assert, { path: /^\/baz\/(\d+)$/ }, {
        GET: {
            '/baz/10': ['/baz/10', '10'],
            '/baz/': false,
            '/baz/fnar': false
        }
    });
    assert.end();
});

test("pattern match", function(assert) {
    testRoute(assert, { path: '/foo/:bar/:id' }, {
        GET: {
            '/foo/asd/99': { bar: 'asd', id: '99' },
            '/foo/asd/99/': false,
            '/foo/asd': false
        }
    });
    assert.end();
});

test("first match wins", function(assert) {
    var r1 = { path: '/:controller' };
    var r2 = { path: /^\/foo$/ };
    var r3 = { path: '/foo' };

    var r = router([r1, r2, r3]);

    var req = {
        method: 'GET',
        uri: { pathname: '/foo' }
    };

    assert.equals(r(req)[0], r1);
    assert.end();
});