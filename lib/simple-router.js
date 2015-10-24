const rescape = require('escape-string-regexp');

const EMPTY = {};
Object.freeze(EMPTY);

module.exports = function(routes) {
    
    // preprocess routes
    routes.forEach(function(r) {
        
        if (r.method) {
            r.method = r.method.toUpperCase();
        }

        var path = r.path;
        
        if (typeof path === 'string') {
            if (path.indexOf(':') >= 0) {
                var names = [null];
                path = new RegExp((rescape(path) + '$').replace(/\:(\w+)/g, function(_, name) {
                    names.push(name);
                    return '([^\/$]+)';
                }));
                r._matchPath = function(rp) {
                    var ms = rp.match(path);
                    if (!ms) return false;
                    var params = {};
                    for (var i = 1, l = names.length; i < l; ++i) {
                        params[names[i]] = ms[i];
                    }
                    return params;
                }
            } else {
                r._matchPath = function(rp) {
                    return (path === rp) ? EMPTY : false;
                }   
            }
        } else if (path instanceof RegExp) {
            r._matchPath = function(rp) { return rp.match(path); }
        } else {
            r._matchPath = function(rp) { return EMPTY; }
        }

    });

    function _matches(route, req) {
        if (req.method !== 'OPTIONS') {
            if (route.method && route.method !== req.method) {
                return false;
            }
        }
        return route._matchPath(req.uri.pathname);
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