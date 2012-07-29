if (!Meteor.accounts.twitter) {
  Meteor.accounts.twitter = {};
}

Meteor.accounts.twitter.config = function(appId, appUrl, options) {
  Meteor.accounts.twitter._appId = appId;
  Meteor.accounts.twitter._appUrl = appUrl;
  Meteor.accounts.twitter._options = options;
};


