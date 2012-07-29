var crypto = __meteor_bootstrap__.require("crypto");
var querystring = __meteor_bootstrap__.require("querystring");

(function () {
  var connect = __meteor_bootstrap__.require("connect");

  Meteor.accounts.oauth1._services = {};

  // Register a handler for an OAuth1 service. The handler will be called
  // when we get an incoming http request on /_oauth1/{serviceName}. This
  // handler should use that information to fetch data about the user
  // logging in.
  //
  // @param name {String} e.g. "google", "twitter"
  // @param handleOauthRequest {Function(query)}
  //   - query is an object with the parameters passed in the query string
  //   - return value is:
  //     - {options: (options), extra: (optional extra)} (same as the
  //       arguments to Meteor.accounts.updateOrCreateUser)
  //     - `null` if the user declined to give permissions
  // XXX In the context of oauth1 the name handleOauthRequest doesn't make as much sense
  Meteor.accounts.oauth1.registerService = function (name, handleOauthRequest) {
    if (Meteor.accounts.oauth1._services[name])
      throw new Error("Already registered the " + name + " OAuth1 service");

    Meteor.accounts.oauth1._services[name] = {
      handleOauthRequest: handleOauthRequest
    };
  };

  // Listen to calls to `login` with an oauth option set
  Meteor.accounts.registerLoginHandler(function (options) {
    if (!options.oauth)
      return undefined; // don't handle

    var result = Meteor.accounts.oauth1._loginResultForState[options.oauth.state];
    if (result === undefined) // not using `!result` since can be null
      // We weren't notified of the user authorizing the login.
      return null;
    else
      return result;
  });

  // When we get an incoming OAuth http request we complete the oauth
  // handshake, account and token setup before responding.  The
  // results are stored in this map which is then read when the login
  // method is called. Maps state --> return value of `login`
  //
  // XXX we should periodically clear old entries
  Meteor.accounts.oauth1._loginResultForState = {};

  // connect middleware
  Meteor.accounts.oauth1._handleRequest = function (req, res, next) {

    // req.url will be "/_oauth1/<service name>?<action>"
    var barePath = req.url.substring(0, req.url.indexOf('?'));
    var splitPath = barePath.split('/');
    // XXX lookup provider
    var urls = Meteor.accounts.twitter._urls;

    // Any non-oauth request will continue down the default middlewares
    if (splitPath[1] !== '_oauth1') {
      next();
      return;
    }

    // Make sure we prepare the login results before returning.
    // This way the subsequent call to the `login` method will be
    // immediate.

    var serviceName = splitPath[2];
    var service = Meteor.accounts.oauth1._services[serviceName];

    var oauth = new OAuth(urls);

    if (req.query.callbackUrl) {
      return oauth.getRequestToken(req.query.callbackUrl, function(err, requestToken) {
        if (!err) {
          var redirectUrl = urls.authenticate + '?oauth_token=' + requestToken.oauth_token;
          res.writeHead(302, {'Location': redirectUrl});
          res.end();
        } else {
          res.writeHead(200, {'Content-Type': 'text/html'});
          res.end('', 'utf-8');
        }
      });
    } else {
      return oauth.getAccessToken(req.query.oauth_token, function(err, accessToken) {

        // // Get or create user id
        var oauthResult = service.handleOauthRequest(oauth);
        
        if (oauthResult) { // could be null if user declined permissions
          var userId = Meteor.accounts.updateOrCreateUser(oauthResult.options, oauthResult.extra);

          // Generate and store a login token for reconnect
          // XXX this could go in accounts_server.js instead
          var loginToken = Meteor.accounts._loginTokens.insert({userId: userId});

          // Store results to subsequent call to `login`
          Meteor.accounts.oauth1._loginResultForState[req.query.state] =
            {token: loginToken, id: userId};
        }

        // We support ?close and ?redirect=URL. Any other query should
        // just serve a blank page
        if ('close' in req.query) { // check with 'in' because we don't set a value
          // Close the popup window
          res.writeHead(200, {'Content-Type': 'text/html'});
          var content =
                '<html><head><script>window.close()</script></head></html>';
          res.end(content, 'utf-8');
        } else if (req.query.redirect) {
          res.writeHead(302, {'Location': req.query.redirect});
          res.end();
        } else {
          res.writeHead(200, {'Content-Type': 'text/html'});
          res.end('', 'utf-8');
        }
      });
    }
  };

  // Listen on /_oauth/*
  __meteor_bootstrap__.app
    .use(connect.query())
    .use(function(req, res, next) {
      // Need to create a Fiber since we're using synchronous http
      // calls and nothing else is wrapping this in a fiber
      // automatically
      Fiber(function () {
        Meteor.accounts.oauth1._handleRequest(req, res, next);
      }).run();
    });

  OAuth = function(urls) {
    this.urls = urls;
  };

  OAuth.prototype.getRequestToken = function(callbackUrl, fn) {

    var authHeader = this._buildHeader({
      oauth_callback: callbackUrl
    });

    authHeader.oauth_signature = this._getSignature('POST', this.urls.requestToken, authHeader);

    // XXX Move to it's own method we do this twice
    var authString = 'OAuth ' +  _.map(authHeader, function(val, key) {
      return encodeURIComponent(key) + '="' + encodeURIComponent(val) + '"'; 
    }).sort().join(', ');

    // XXX Modularize this, most of its in two places
    // XXX Use sync interface
    Meteor.http.post(this.urls.requestToken, {
      headers: {
        // XXX can we remove this line?
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: authString
      }
    }, function(err, response) {
      if (err) {
        fn(err);
      } else {
        var token = querystring.parse(response.content);
        fn(null, token);
      }
    });
  };

  OAuth.prototype.getAccessToken = function(oauthToken, fn) {
    var self = this;

    // XXX too much in common with getRequestToken
    var authHeader = this._buildHeader({
      oauth_token: oauthToken
    });
    authHeader.oauth_signature = this._getSignature('POST', this.urls.accessToken, authHeader);

    // XXX Move to it's own method we do this twice
    var authString = 'OAuth ' +  _.map(authHeader, function(val, key) {
      return encodeURIComponent(key) + '="' + encodeURIComponent(val) + '"'; 
    }).join(', ');

    // XXX Modularize this, most of its in two places
    // XXX Use sync interface
    Meteor.http.post(this.urls.accessToken, {
      headers: {
        // XXX can we remove this line?
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: authString
      }
    }, function(err, response) {
      if (err) {
        fn(err);
      } else {
        // XXX Don't call this token
        self.token = querystring.parse(response.content);
        fn(null, self.token);
      }
    });
  };

  OAuth.prototype.call = function(method, url) {
    var authHeader = {
      oauth_token: this.token.oauth_token,
      // Fixy
      oauth_consumer_key: Meteor.accounts.twitter._appId,
      oauth_nonce: Meteor.uuid().replace(/\W/g, ''),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: (new Date().valueOf()/1000).toFixed().toString(),
      oauth_version: '1.0'
    };

    // XXX Fixy
    authHeader.oauth_signature = this._getSignature(method.toUpperCase(), url, authHeader, this.token.oauth_token_secret);

    // XXX Move to it's own method we do this twice
    var authString = 'OAuth ' +  _.map(authHeader, function(val, key) {
      return encodeURIComponent(key) + '="' + encodeURIComponent(val) + '"'; 
    }).sort().join(', ');

    var result = Meteor.http[method.toLowerCase()](url, {
      headers: {
        Authorization: authString
      }
    });

    if (result.error)
      throw result.error;
    return result.data;
  };

  OAuth.prototype.get = function(url) {
    return this.call('get', url);
  };

  OAuth.prototype._buildHeader = function(headers) {
    return _.extend({
      oauth_consumer_key: Meteor.accounts.twitter._appId,
      oauth_nonce: Meteor.uuid().replace(/\W/g, ''),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: (new Date().valueOf()/1000).toFixed().toString(),
      oauth_version: '1.0'
    }, headers);
  };

  OAuth.prototype._getSignature = function(method, url, rawHeaders, oauthSecret) {

    var headers = this._encodeHeader(rawHeaders);

    var parameters = _.map(headers, function(val, key) {
      return key + '=' + val;
    }).sort().join('&');

    var signatureBase = [
      method,
      encodeURIComponent(url),
      encodeURIComponent(parameters)
    ].join('&');

    var signingKey = encodeURIComponent(Meteor.accounts.twitter._secret) + '&';
    if (oauthSecret)
      signingKey += encodeURIComponent(oauthSecret);

    return crypto.createHmac('SHA1', signingKey).update(signatureBase).digest('base64');
  };

  OAuth.prototype._encodeHeader = function(header) {
    return _.reduce(header, function(memo, val, key) {
      memo[encodeURIComponent(key)] = encodeURIComponent(val);
      return memo;
    }, {});
  };

})();
