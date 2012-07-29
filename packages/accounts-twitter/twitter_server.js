(function () {

  Meteor.methods({
    getRequestToken: function() {
      return 123;
    }
  });

  Meteor.accounts.twitter.setSecret = function (secret) {
    Meteor.accounts.twitter._secret = secret;
  };

  var urls = {
    requestToken: "https://api.twitter.com/oauth/request_token",
    authorize: "https://api.twitter.com/oauth/authorize",
    accessToken: "https://api.twitter.com/oauth/access_token",
    authenticate: "https://api.twitter.com/oauth/authenticate"
  };

  Meteor.accounts.oauth1.registerService('twitter', urls, function(accessToken) {
    var identity = getIdentity(accessToken);

    return {
      options: {
        email: identity.email,
        services: {twitter: {id: identity.id, accessToken: accessToken}}
      },
      extra: {name: identity.name}
    };
  });

  // XXX Extract any behavior that our implementation is missing
  // var getAccessToken = function (query) {
  //   // Request an access token
  //   var result = Meteor.http.get(
  //     "https://graph.facebook.com/oauth/access_token", {
  //       params: {
  //         client_id: Meteor.accounts.twitter._appId,
  //         redirect_uri: Meteor.accounts.twitter._appUrl + "/_oauth/twitter?close",
  //         client_secret: Meteor.accounts.twitter._secret,
  //         code: query.code
  //       }
  //     });
  // 
  //   if (result.error)
  //     throw result.error;
  //   var response = result.content;
  // 
  //   // Errors come back as JSON but success looks like a query encoded
  //   // in a url
  //   var error_response;
  //   try {
  //     // Just try to parse so that we know if we failed or not,
  //     // while storing the parsed results
  //     error_response = JSON.parse(response);
  //   } catch (e) {
  //     error_response = null;
  //   }
  // 
  //   if (error_response) {
  //     throw new Meteor.Error(500, "Error trying to get access token from Twitter", error_response);
  //   } else {
  //     // Success!  Extract the twitter access token from the
  //     // response
  //     var fbAccessToken;
  //     _.each(response.split('&'), function(kvString) {
  //       var kvArray = kvString.split('=');
  //       if (kvArray[0] === 'access_token')
  //         fbAccessToken = kvArray[1];
  //       // XXX also parse the "expires" argument?
  //     });
  // 
  //     if (!fbAccessToken)
  //       throw new Meteor.Error(500, "Couldn't find access token in HTTP response.");
  //     return fbAccessToken;
  //   }
  // };

  // var getIdentity = function (accessToken) {
  //   
  //   // XXX Get all of this out of here
  //   var authHeader = {
  //     oauth_consumer_key: Meteor.accounts.twitter._appId,
  //     oauth_nonce: Meteor.uuid().replace(/\W/g, ''),
  //     oauth_signature_method: 'HMAC-SHA1',
  //     // Borrowed this line from https://github.com/itea/oauthjs
  //     oauth_timestamp: (new Date().valueOf()/1000).toFixed().toString(),
  //     oauth_version: '1.0'
  //   };
  // 
  //   var url = "https://api.twitter.com/1/account/verify_credentials.json";
  //   authHeader.oauth_token = accessToken.oauth_token;
  //   authHeader.oauth_signature = getSignature('GET', url, authHeader, authHeader.oauth_token_secret);
  //   // authHeader = reorderHeaders(authHeader);
  // 
  //   // XXX Move to it's own method we do this twice
  //   var authString = 'OAuth ' +  _.map(authHeader, function(val, key) {
  //     return encodeURIComponent(key) + '="' + encodeURIComponent(val) + '"'; 
  //   }).sort().join(', ');
  // 
  //   var result = Meteor.http.get(url, {
  //     headers: {
  //       'Content-Type': 'application/x-www-form-urlencoded',
  //       Authorization: authString
  //     }
  //   });
  // 
  //   if (result.error)
  //     throw result.error;
  //   return result.data;
  // };
}) ();
