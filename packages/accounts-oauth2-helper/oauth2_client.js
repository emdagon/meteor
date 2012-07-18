(function () {

  // Interface registry
  var interfaces = {
    
    // Defines a popup window interface (the default) for oauth2 authentication
    popup: function(url, options, afterLogin) {
      options = options || {};
      var width = options.width || 650;
      var height = options.height || 331;

      var openCenteredPopup = function(url, width, height) {
        var screenX = typeof window.screenX !== 'undefined'
              ? window.screenX : window.screenLeft;
        var screenY = typeof window.screenY !== 'undefined'
              ? window.screenY : window.screenTop;
        var outerWidth = typeof window.outerWidth !== 'undefined'
              ? window.outerWidth : document.body.clientWidth;
        var outerHeight = typeof window.outerHeight !== 'undefined'
              ? window.outerHeight : (document.body.clientHeight - 22);

        // Use `outerWidth - width` and `outerHeight - height` for help in
        // positioning the popup centered relative to the current window
        var left = screenX + (outerWidth - width) / 2;
        var top = screenY + (outerHeight - height) / 2;
        var features = ('width=' + width + ',height=' + height +
                        ',left=' + left + ',top=' + top);

        var newwindow = window.open(url, 'Login', features);
        if (newwindow.focus)
          newwindow.focus();
        return newwindow;
      };

      var popup = openCenteredPopup(url, width, height);

      var checkPopupOpen = setInterval(function() {
        if (popup.closed) {
          clearInterval(checkPopupOpen);
          afterLogin();
        }
      }, 100);
    }
  };

  // Register a callback for custom interfaces

  // @param name {String} name of interface
  // @param interface {Function} A function that launches the interface
  Meteor.accounts.oauth2.addInterface = function(name, interface) {
    interfaces[name] = interface;
  };

  // Open a popup window pointing to a OAuth handshake page
  //
  // @param state {String} The OAuth state generated by the client
  // @param url {String} url to page
  Meteor.accounts.oauth2.initiateLogin = function(state, url, options) {
    interface = (options && options.interface) || 'popup';

    var afterLogin = function() {
      Meteor.apply('login', [
        {oauth: {version: 2, state: state}}
      ], {wait: true}, function(error, result) {
        if (error)
          throw error;
      
        if (!result) {
          // The user either closed the OAuth popup or didn't authorize
          // access.  Do nothing.
          return;
        } else {
          Meteor.accounts.makeClientLoggedIn(result.id, result.token);
        }
      });
    };

    interfaces[interface](url, options, afterLogin);
  };
})();
