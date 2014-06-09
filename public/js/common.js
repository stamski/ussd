(function(){
  var phoneScreen;
  var codeInput;

  function formatResponse(data){
    var parsedData = JSON.parse(data);
    var message = parsedData.message;
    var options = parsedData.currentState && parsedData.currentState.options;
    var _default = parsedData.currentState && parsedData.currentState.default;
    var formattedData = "";
    if(message) {
      formattedData += message + "\n";
    }
    if(_default) {
      formattedData += _default.text + "\n";
    }
    if(options){
      for (var option in options) {
        if(options.hasOwnProperty(option)){
          formattedData += option + "." + options[option].text + "\n";
        }
      }
    }
    return formattedData;
  }

  function sendRequest(data){
    $.ajax({
      url: 'ussd',
      type: 'POST',
      data: JSON.stringify(data),
    })
    .done(function(data) {
      console.log("\nsuccess: \n\n"+ data);
      phoneScreen.text(formatResponse(data));
    })
    .fail(function(err) {
      console.log("error: " + err.message);
    })
    .always(function() {
      //console.log("complete");
    });
  }

  $(document).ready(function(){
      phoneScreen = $('#phone_screen code');
      codeInput = $('#code-input input');
      var sessionID = Math.random();
      $('#send-command').on('click', function(){
        sendRequest({"sessionID" : sessionID ,"input": codeInput.val()});
        codeInput.val('').focus();
      });
      $('#redBtn').on('click', function(){
        //phoneScreen.text("Session Closed");
        sendRequest({"sessionID" : sessionID, "closeSession": true});
        codeInput.focus();
      });
      $('#clearBtn').on('click', function(){
        var val = codeInput.val(); 
        codeInput.val(val.substring(0, val.length - 1))
      });

  });
})();