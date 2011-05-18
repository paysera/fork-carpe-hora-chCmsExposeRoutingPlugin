/*!
 * routing.js
 * Copyright (c) 2011 Julien Muetton <julien_muetton@carpe-hora.com>
 * MIT Licensed
 */

/**
 * define Routing class
 */

$.ExposeRouting = $.ExposeRouting || {};

(function(Routing, $, undefined) {

  // now register our routing methods
  $.extend(Routing, (function() {

    var _routes = {},
        _defaults = {},
        rquery = /\?/,
        rabsurl = /^\//,
        rescregexp = /[-[\]{}()*+?.,\\^$|#\s]/g,
        rdblslash = /\/\//g,
        self = Routing,
        ServerMethods = {};

    /**
     * @api private
     * prepare a regexp part with several caracters/parts
     * having to be escaped.
     *
     *    regexify('a'); // returns 'a'
     *    regexify(['a', '.']); // returns 'a|\.'
     *    regexify(['a', '.'], '$'); // returns 'a|\.|$'
     *
     * @param {Array|string}  separators  a list of separators.
     * @param {String}        unescaped   a meta character to use in regexp.
     * @return {String}      the regexp part, ready to use.
     */
    function regexify(separators, unescaped) {
      var _i, _separators = [];
      // make sure separator is an array
      if (!$.isArray(separators)) {
        separators = [separators];
      }
      // escape every separator
      for (_i in separators) {
        _separators[_i] = separators[_i].replace(rescregexp, '\\$&');
      }
      // add unescaped caracters
      if (unescaped) { _separators.push(unescaped); }

      // return in a or
      if (_separators.length > 1) {return _separators.join('|')}
      else if (_separators.length) {return _separators[0];}
      return '';
    };

    /**
     * replace params in given url.
     * **WARNING:** used params are removed.
     *
     * @param {String} url the raw url.
     * @param {Object} params the params to replace.
     * @return {String} the treated url.
     * @api private
     */
    function replace_params(url, params) {
        var _i,
            _url = url,
            _separators = self.segmentSeparators,
            _prefixes = regexify(self.variablePrefix),
            _suffixes = regexify(self.variableSuffix),
            _prefix = '(' + regexify(_separators, '^') + ')' + _prefixes,
            _suffix = _suffixes + '(' + regexify(_separators, '$') + ')';
        for (_i in params) {
          var _r = new RegExp(_prefix + _i + _suffix, '');

          if (_r.test(_url)) {
            _url = _url.replace(_r, '$1' + params[_i] + '$2');
            delete(params[_i]);
          }
        }

        return _url;
    };

    /**
     * get, put,  post, del:
     * ====================
     * send server request at route url from route id and params.
     *
     * @param {String}    route_id    the id of route to generate url for.
     * @param {Object}    [params]    the parameters to append to the route.
     * @param {Function}  [callback=success(data, textStatus, jqXHR)]  function for success.
     * @param {String}    [type]      the return data type.
     * @api public
     */
    $(["get", "post"]).each(function(i, method) {
        ServerMethods[method] = function(route_id, data, callback, type) {
          // shift arguments if data is ommited
          if ($.isFunction(data)) {
            type = type || callback;
            callback = data;
            data = undefined;
          }

          return $[method](self.generate(route_id, data, false), data, callback, type);
        }
      });
    $(["put", "del"]).each(function(i, method) {
        ServerMethods[method] = function(route_id, data, callback, type) {
          var _data = data;
          // shift arguments if data is ommited
          if ($.isFunction(_data)) {
            type = type || callback;
            callback = _data;
            _data = {};
          }
          // extend with method
          _data = _data || {};
          _data[self.methodParameterName] = method;

          return $.post(self.generate(route_id, _data, false), $.extend(_data), callback, type);
        }
      });

    return $.extend(ServerMethods, {
      /**
       * default routing parameters for every routes.
       *
       * @api public
       */
      defaults: {},
      /**
       * route parameter suffix.
       *
       * @type {String}
       * @api public
       */
      variableSuffix: '',
      /**
       * route parameter prefix.
       *
       * @type {String}
       * @api public
       */
      variablePrefix: ':',
      /**
       * route url separator list.
       *
       * @type {String|Array}
       * @api public
       */
      segmentSeparators: ['/', '.'],
      /**
       * route url prefix to use.
       *
       * @type {String}
       * @api public
       */
      prefix: '',
      /**
       * the cross site request forgery defaults
       *
       * @type {Object}
       * @api public
       */
      csrf: {},
      /**
       * name for the parameter used to specify non HTTP 1.0 method name
       *
       * @type {String}
       */
      methodParameterName: 'sf_method',
      /**
       * connect a route.
       *
       * @param {String} id       the route id.
       * @param {String} pattern  the url pattern.
       * @return {Object} Routing.
       * @api public
       */
      connect: function(id, pattern, defaults) {
        _routes[id] = pattern;
        _defaults[id] = defaults || {};
        return self;
      },
      /**
       * retrieve a route by it's id.
       *
       * @param {String} route_id the route id to retrieve.
       * @return {String} requested route.
       * @api public
       */
      getRoute: function(route_id) {
        return _routes[route_id] || undefined;
      },
      /**
       * determines wether a route is registered or not.
       *
       * @param {String} route_id the route id to retrieve.
       * @return {Boolean} wether the route is registered or not.
       * @api public
       */
      has: function(route_id) {
        return (_routes[route_id] ? true : false);
      },
      /**
       * clears all routes
       *
       * @return {Object} Routing.
       * @api public
       */
      flush: function() {
        _routes = {};
        _defaults = {};
        return self;
      },
      /**
       * generate a route url from route id and params.
       * **Warnig**: given params are modified !
       * used parameters are 
       *
       * @param {String}  route_id  the id of route to generate url for.
       * @param {Object} params    the parameters to append to the route.
       * @param {Boolean} withExtraParameters include extra parameters to url ? (default = true).
       * @return {String} generated url.
       * @api public
       */
      generate: function(route_id, params, withExtraParameters) {
        var _route = self.getRoute(route_id),
            _queryString,
            _url = _route;

        if (!_url) {
          throw 'No matching route for ' + route_id;
        }

        // replace with params then defaults
        _url = replace_params(_url, params);
        _url = replace_params(_url, $.extend({}, 
                                      self.defaults || {}, 
                                      _defaults[route_id] || {}));

        // remaining params as query string
        if (withExtraParameters || undefined === withExtraParameters) {
          _queryString = $.param(params || {});

          if (_queryString.length) {
            _url += (rquery.test(_url) ? '&' : '?') + _queryString;
          }
        }

        _url = (rabsurl.test(_url) ? '' : '/') + _url;
        _url = self.prefix + _url;
        _url = (rabsurl.test(_url) ? '' : '/') + _url;

        return _url.replace(rdblslash, '/');
      }
    }); // end of return/extend
  })());
})($.ExposeRouting, jQuery);
