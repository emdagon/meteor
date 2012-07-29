(function () {
  var connect = __meteor_bootstrap__.require("connect");
  var crypto = __meteor_bootstrap__.require("crypto");
  var querystring = __meteor_bootstrap__.require("querystring");

  Meteor.accounts.oauth1._services = {};

  // Register a handler for an OAuth1 service. The handler will be called
  // when we get an incoming http request on /_oauth/{serviceName}. This
  // handler should use that information to fetch data about the user
  // logging in.
  //
  // @param name {String} e.g. "google", "facebook"
  // @param handleOauthRequest {Function(query)}
  // XXX Clean this up based when the dust settles
  //   - query is an object with the parameters passed in the query string
  //   - return value is:
  //     - {options: (options), extra: (optional extra)} (same as the
  //       arguments to Meteor.accounts.updateOrCreateUser)
  //     - `null` if the user declined to give permissions
  Meteor.accounts.oauth1.registerService = function (name, urls, handleOauthRequest) {
    if (Meteor.accounts.oauth1._services[name])
      throw new Error("Already registered the " + name + " OAuth1 service");

    Meteor.accounts.oauth1._services[name] = {
      handleOauthRequest: handleOauthRequest,
      urls: urls
    };
  };

  // Listen to calls to `login` with an oauth option set
  Meteor.accounts.registerLoginHandler(function oauth1LoginHandler(options) {
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

  var getSignature = function(method, url, rawHeaders, oauthSecret) {
    
    var headers = encodeHeader(rawHeaders);

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

  var encodeHeader = function(header) {
    return _.reduce(header, function(memo, val, key) {
      memo[encodeURIComponent(key)] = encodeURIComponent(val);
      return memo;
    }, {});
  };

  var reorderHeaders = function(headers) {
    return _.reduce(_.keys(headers).sort(), function(memo, key) {
      memo[key] = headers[key];
      return memo;
    }, {});
  };

  var getAccessToken = function(url, oauthToken, fn) {
    // XXX too much in common with getRequestToken
    var authHeader = {
      oauth_token: oauthToken,
      oauth_consumer_key: Meteor.accounts.twitter._appId,
      // XXX try removing one uuid
      oauth_nonce: (Meteor.uuid() + Meteor.uuid()).replace(/\W/g, ''),
      oauth_signature_method: 'HMAC-SHA1',
      // Borrowed this line from https://github.com/itea/oauthjs
      oauth_timestamp: (new Date().valueOf()/1000).toFixed().toString(),
      oauth_version: '1.0'
    };
    authHeader.oauth_signature = getSignature('POST', url, authHeader);

    // XXX Move to it's own method we do this twice
    var authString = 'OAuth ' +  _.map(authHeader, function(val, key) {
      return encodeURIComponent(key) + '="' + encodeURIComponent(val) + '"'; 
    }).join(', ');

    // XXX Modularize this, most of its in two places
    // XXX Use sync interface
    Meteor.http.post(url, {
      headers: {
        // XXX can we remove this line?
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: authString
      }
    }, function(err, response) {
      if (err) {
        fn(err);
      } else {
        token = querystring.parse(response.content);
        fn(token);
      }
    });
  };

  var getRequestToken = function(url, fn) {
    var token;
    var authHeader = {
      oauth_callback: Meteor.accounts.twitter._appUrl + '/_oauth1/twitter?close',
      oauth_consumer_key: Meteor.accounts.twitter._appId,
      // XXX try removing one uuid
      oauth_nonce: (Meteor.uuid() + Meteor.uuid()).replace(/\W/g, ''),
      oauth_signature_method: 'HMAC-SHA1',
      // Borrowed this line from https://github.com/itea/oauthjs
      oauth_timestamp: (new Date().valueOf()/1000).toFixed().toString(),
      oauth_version: '1.0'
    };

    authHeader.oauth_signature = getSignature('POST', url, authHeader);
    // XXX Don't think we ever need to do this
    authHeader = reorderHeaders(authHeader);

    // XXX Move to it's own method we do this twice
    var authString = 'OAuth ' +  _.map(authHeader, function(val, key) {
      return encodeURIComponent(key) + '="' + encodeURIComponent(val) + '"'; 
    }).join(', ');
    
    // XXX Modularize this, most of its in two places
    // XXX Use sync interface
    Meteor.http.post(url, {
      headers: {
        // XXX can we remove this line?
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: authString
      }
    }, function(err, response) {
      if (err) {
        fn(err);
      } else {
        token = querystring.parse(response.content);
        fn(token);
      }
    });
  };

  var getIdentity = function(accessToken) {
    var authHeader = {
      oauth_token: accessToken.oauth_token,
      oauth_consumer_key: Meteor.accounts.twitter._appId,
      oauth_signature_method: 'HMAC-SHA1',
      // Borrowed this line from https://github.com/itea/oauthjs
      oauth_timestamp: (new Date().valueOf()/1000).toFixed().toString(),
      oauth_version: '1.0'
    };
    
    var url = "https://api.twitter.com/1/account/verify_credentials.json";
    authHeader.oauth_signature = getSignature('GET', url, authHeader, accessToken.oauth_token_secret);
    
    // XXX Move to it's own method we do this twice
    var authString = 'OAuth ' +  _.map(authHeader, function(val, key) {
      return encodeURIComponent(key) + '="' + encodeURIComponent(val) + '"'; 
    }).sort().join(', ');
    
    var result = Meteor.http.get(url, {
      'Host': 'api.twitter.com',
      'Content-Type': 'application/x-www-form-urlencoded',
      headers: {
        Authorization: authString
      }
    });
    
    if (result.error)
      throw result.error;
    return result.data;
  };

  // connect middleware
  Meteor.accounts.oauth1._handleRequest = function (req, res, next) {
    // XXX /_oauth1/ is seems ugly but I'm unsure how else to coexist 
    // with oauth2 paths. Perhaps we make them both ugly... or figure
    // out regular expressions for each type based on what's registered
    // e.g. somewhere in regex for oauth1 (twitter|flickr)

    // req.url will be "/_oauth1/<service name>[?<action>]"
    var barePathEndIndex = req.url.indexOf('?') >=0 ? req.url.indexOf('?') : req.url.length;
    var splitUrl = req.url.split('?', 2);
    var barePath = splitUrl[0];
    var splitPath = barePath.split('/');

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

    var action = splitUrl[1];

    // If there is an <action> the provider is redirecting the user
    // back to the application
    if (action) {
      
      if (req.query.error) {
        // The user didn't authorize access
        return null;
      }

      if (!Meteor.accounts.twitter._appId || !Meteor.accounts.twitter._appUrl)
        throw new Meteor.accounts.ConfigError("Need to call Meteor.accounts.twitter.config first");
      if (!Meteor.accounts.twitter._secret)
        throw new Meteor.accounts.ConfigError("Need to call Meteor.accounts.twitter.setSecret first");

      return getAccessToken(service.urls.accessToken, req.query.oauth_token, function(accessToken) {

        var identity = getIdentity(accessToken);
        
        var oauthResult = {
          options: {
            // XXX fixy
            email: identity.screen_name + '@twitter.com',
            // XXX fixy
            services: {twitter: {id: identity.id, accessToken: accessToken.oauth_token, accessTokenSecret: accessToken.oauth_token_secret}}
          },
          extra: {name: identity.name}
        };

        if (oauthResult) { // could be null if user declined permissions
          var userId = Meteor.accounts.updateOrCreateUser(oauthResult.options, oauthResult.extra);

          // Generate and store a login token for reconnect
          // XXX this could go in accounts_server.js instead
          var loginToken = Meteor.accounts._loginTokens.insert({userId: userId});

          // Store results to subsequent call to `login`
          console.log('req.query', req.query);
          console.log('req.query.state', req.query.state);
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
      
    // If no action is specified the user is initiating the login process
    } else {
      return getRequestToken(service.urls.requestToken, function(requestToken) {
        var redirectUrl = service.urls.authenticate + '?oauth_token=' + requestToken.oauth_token;
        res.writeHead(302, {'Location': redirectUrl});
        res.end('moof ' + requestToken);
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

})();
