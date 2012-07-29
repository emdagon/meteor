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

    // Get or create user id
    var oauthResult = service.handleOauthRequest(req.query);

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
