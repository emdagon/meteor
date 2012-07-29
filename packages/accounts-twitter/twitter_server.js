(function () {

  Meteor.accounts.twitter.setSecret = function (secret) {
    Meteor.accounts.twitter._secret = secret;
  };

  Meteor.accounts.oauth1.registerService('twitter', function(oauth) {
    // XXX Decide where this should live
    // if (query.error) {
    //   // The user didn't authorize access
    //   return null;
    // }
    // 
    // XXX Decide where this should live
    // if (!Meteor.accounts.twitter._appId || !Meteor.accounts.twitter._appUrl)
    //   throw new Meteor.accounts.ConfigError("Need to call Meteor.accounts.twitter.config first");
    // if (!Meteor.accounts.twitter._secret)
    //   throw new Meteor.accounts.ConfigError("Need to call Meteor.accounts.twitter.setSecret first");

    var identity = oauth.get('https://api.twitter.com/1/account/verify_credentials.json');

    return {
      options: {
        // Fixy!
        email: identity.screen_name + '@twitter.com',
        services: {twitter: {id: identity.id, accessToken: oauth.accessToken}}
      },
      extra: {name: identity.name}
    };
  });

  // XXX Look for behavior that we need and move it where it belongs
  // var getAccessToken = function (query) {
  //   // Request an access token
  //   var result = Meteor.http.get(
  //     "https://graph.facebook.com/oauth/access_token", {
  //       params: {
  //         client_id: Meteor.accounts.twitter._appId,
  //         redirect_uri: Meteor.accounts.twitter._appUrl + "/_oauth1/twitter?close",
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
  // 
  // var getIdentity = function (accessToken) {
  //   var result = Meteor.http.get("https://graph.facebook.com/me", {
  //     params: {access_token: accessToken}});
  // 
  //   if (result.error)
  //     throw result.error;
  //   return result.data;
  // };
}) ();
