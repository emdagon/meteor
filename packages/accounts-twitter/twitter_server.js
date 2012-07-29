(function () {

  Meteor.accounts.twitter.setSecret = function (secret) {
    Meteor.accounts.twitter._secret = secret;
  };

  Meteor.accounts.oauth1.registerService('twitter', function(oauth) {

    var identity = oauth.get('https://api.twitter.com/1/account/verify_credentials.json');

    return {
      options: {
        // XXX Fixy!
        email: identity.screen_name + '@twitter.com',
        services: {twitter: {id: identity.id, accessToken: oauth.accessToken}}
      },
      extra: {name: identity.name}
    };
  });
}) ();
