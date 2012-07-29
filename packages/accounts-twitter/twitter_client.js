(function () {
  Meteor.loginWithTwitter = function () {
    if (!Meteor.accounts.twitter._appId || !Meteor.accounts.twitter._appUrl)
      throw new Meteor.accounts.ConfigError("Need to call Meteor.accounts.twitter.config first");

    var state = Meteor.uuid();
    var mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry/i.test(navigator.userAgent);
    var display = mobile ? 'touch' : 'popup';

    var scope = "email";
    if (Meteor.accounts.twitter._options &&
        Meteor.accounts.twitter._options.scope)
      scope = Meteor.accounts.twitter._options.scope.join(',');

    Meteor.accounts.oauth1.initiateLogin(state);
  };

})();




