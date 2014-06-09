var ussd = (function(){

  function USSD(){
    this.mongo = require('mongodb').MongoClient;
    this.code = "123";
    this.test = Math.random();
    this.defaultBalance = 100;
  }

  USSD.prototype.responseHandler = function USSD__responseHandler(reqData, res){
    var self = this;
    var parsedReqData = JSON.parse(reqData);
    var sessionID = parsedReqData.sessionID;
    var input = parsedReqData.input;
    var closeSession = parsedReqData.closeSession;
    this.mongo.connect('mongodb://127.0.0.1:27017', function(err, db) {
      if(err) throw err;
      var USSDSession = db.collection('USSDSession');
      USSDSession.findOne({"_id" : sessionID}, function(err, sessionRecord) {
        if(err) throw err;
        if(!sessionRecord){
          if(input != self.code){
            self.sendResponse({}, res, db);
          } else {
            USSDSession.insert({"_id" : sessionID}, function(err, insertedRecords){
              if(err) throw err;
              self.goToNextState(insertedRecords[0], "main", {input: input, message: null}, res, db);
            });
          }
        } else {
          if(closeSession){
            self.closeSession(sessionRecord, res, db);
          } else {
            self.processReceivedInput(sessionRecord, input, res, db);
          } 
        }
      });
    });
  };

  USSD.prototype.processReceivedInput = function USSD__processReceivedInput(sessionRecord, input, res, db){
    var self = this;
    var options = sessionRecord.currentState.options;
    var message = null;
    var stateID = null;
    if(options[input]) {
      stateID = options[input].goto;
      self.goToNextState(sessionRecord, stateID, {input: input, message: message}, res, db);
    } else {
      self.sendResponse(sessionRecord.currentState, res, db)
    }
  };
  // @override
  USSD.prototype.processReceivedInput = function USSD__processReceivedInput(sessionRecord, input, res, db){
    var self = this;
    var options = sessionRecord.currentState.options;
    var message = "";
    var stateID = sessionRecord.currentState._id;
    var defaultNextStateID = sessionRecord.currentState.default && sessionRecord.currentState.default.goto;
    var sortArray = function compare(a,b) {
      if (a.date > b.date)
         return -1;
      if (a.date < b.date)
        return 1;
      return 0;
    };
    var formatDate = function(date){
      return date.getDate() + "/" +
             date.getMonth() + "/" +
             date.getFullYear() + " " +
             date.getHours() + ":" +
             date.getMinutes()
    };
    if(options[input]) {
      switch(stateID){
        case "send-money-prompt":
          if(input==='1') {
            console.log(stateID);
            var username = sessionRecord.username;
            var peerUsername = sessionRecord.peerUsername;
            var amount = parseInt(sessionRecord.amount);
            var date = new Date();
            var transactions = [
              {
                peer1: username,
                peer2: peerUsername,
                amount: -amount,
                date: date
              },
              {
                peer2: username,
                peer1: peerUsername,
                amount: amount,
                date: date
              }
            ];
            db.collection('Transaction').insert(transactions, function(err, insertedTransactions){
              if(err) throw err;
              db.collection('Account').findOne({"_id" : username}, function(err, sender){
                if(err) throw err;
                var newBalance = parseInt(sender.balance) - amount;
                db.collection('Account').update({"_id" : username}, {$set: {balance: newBalance}}, function(err){
                  if(err) throw err;
                  db.collection('Account').findOne({"_id" : peerUsername}, function(err, receiver){
                    if(err) throw err;
                    newBalance = parseInt(receiver.balance) + amount;
                    db.collection('Account').update({"_id" : peerUsername}, {$set: {balance: newBalance}}, function(err){
                      if(err) throw err;
                      message = amount + " successfully sent to " + peerUsername;
                      self.goToNextState(sessionRecord, options[input].goto, {input: input, message: message}, res, db);
                    });
                  });
                });
              });
            });
            break;
          }
        case "operations":
          console.log(stateID);
          if(input === '2') { // check balance
            console.log('checking balance...')
            db.collection('Account').findOne({"_id" : sessionRecord.username}, function(err, user){
              if(err) throw err;
              message = "current balance: " + user.balance;
              self.goToNextState(sessionRecord, options[input].goto, {input: input, message: message}, res, db);
            });
            break;
          } else if (input === '3'){ // ministatement
            db.collection('Transaction').find({"peer1" : sessionRecord.username}).toArray(function(err, transactions){
              if(err) throw err;
              if(transactions.length > 0) {
                transactions.sort(sortArray);
                var t;
                var action;
                for (var i = 0, n = transactions.length; i < n; i +=1){
                  t = transactions[i];
                  action = t.amount < 0 ? " sent to " : " received from "
                  message += "" + Math.abs(t.amount) + action + t.peer2 + " on\n" + formatDate(t.date) +"\n---------------";
                  if(i==2)
                    break;
                  message += "\n";
                }
              }
              //message = "current balance: " + user.balance;
              self.goToNextState(sessionRecord, options[input].goto, {input: input, message: message}, res, db);
            });
          } else { // send money
            self.goToNextState(sessionRecord, options[input].goto, {input: input, message: message}, res, db);
          }
          break;   
        default:
          console.log(stateID);
          self.goToNextState(sessionRecord, options[input].goto, {input: input, message: message}, res, db);
      }
      
    } else {
      switch(stateID) {
        case "main":
          console.log(stateID);
          self.goToNextState(sessionRecord, stateID, {input: input, message: message}, res, db);
          break;
        case "login-username":          // can fail
          console.log(stateID);
          db.collection('Account').findOne({"_id": input}, function(err, user){
            if(user){
              self.goToNextState(sessionRecord, defaultNextStateID, {username: user._id, password: user.password, input: input, message: message}, res, db);
            } else {
              message = "username doesn't exist";
              self.goToNextState(sessionRecord, stateID, {input: input, message: message}, res, db);
            }
          });
          break;
        case "login-password":          // can fail
          console.log(stateID);
          if(input != sessionRecord.password){
            message = "wrong password";
            self.goToNextState(sessionRecord, stateID, {input: input, message: message}, res, db);
          } else {
            self.goToNextState(sessionRecord, defaultNextStateID, {input: input, message: message}, res, db);
          }
          break;
        case "send-money-username":     // can fail
          console.log(stateID);
          db.collection('Account').findOne({"_id": input}, function(err, user){
            if(user){
              self.goToNextState(sessionRecord, defaultNextStateID, {peerUsername: input, input: input, message: message}, res, db);
            } else {
              message = "username doesn't exist";
              self.goToNextState(sessionRecord, stateID, {input: input, message: message}, res, db);
            }
          });
          break;
        case "send-money-amount":       // can fail
          console.log(stateID);
          if(isNaN(parseInt(input))){
            message = "amount must be a number";
            self.goToNextState(sessionRecord, stateID, {input: input, message: message}, res, db);
          } else {
            db.collection('Account').findOne({"_id": sessionRecord.username}, function(err, user){
              if(user.balance < input){
                message = "insufficient balance";
                self.goToNextState(sessionRecord, stateID, {input: input, message: message}, res, db);
              } else {
                self.goToNextState(sessionRecord, defaultNextStateID, {amount: input, input: input, message: message}, res, db);
              }
            });
          }
          break;
        case "send-money-prompt":
          console.log(stateID);
          self.goToNextState(sessionRecord, stateID, {input: input, message: message}, res, db);
          break;
        case "check-balance":
          console.log(stateID);
        case "ministatement":
          console.log(stateID);
        case "signup-username":         // can fail
          console.log(stateID);
          db.collection('Account').findOne({"_id": input}, function(err, user){
            if(user){
              message = "username already taken";
              self.goToNextState(sessionRecord, stateID, {input: input, message: message}, res, db);
            } else {
              self.goToNextState(sessionRecord, defaultNextStateID, {username: input, input: input, message: message}, res, db);
            }
          });
          break;
        case "signup-password":
          console.log(stateID);
          self.goToNextState(sessionRecord, defaultNextStateID, {password: input, input: input, message: message}, res, db);
          break;
        case "signup-repeat-password":  // can fail
          console.log(stateID);
          if(input != sessionRecord.password){
            message = "password doesn't match";
            self.goToNextState(sessionRecord, stateID, {input: input, message: message}, res, db);
          } else {
            var dataObj = {"_id" : sessionRecord.username, password: sessionRecord.password, balance:self.defaultBalance};
            db.collection('Account').insert(dataObj, function(err, insertedRecords){
              if(err) throw err;
              self.goToNextState(sessionRecord, defaultNextStateID, {input: input, message: message}, res, db);
            });
          }
          break;
        case "send-money-complete":
          console.log(stateID);
          self.goToNextState(sessionRecord, stateID, {input: input, message: message}, res, db);
          
      }
    }
  };

  USSD.prototype.goToNextState = function USSD__goToNextState(sessionRecord, stateID, dataObj, res, db){
    var self = this;
    db.collection('USSDState').findOne({"_id": stateID}, function(err, stateRecord) {
      if(err) throw err;
      self.updateSession(sessionRecord, stateRecord, dataObj, res, db);
    });
  };

  USSD.prototype.updateSession = function USSD__updateSession(sessionRecord, stateRecord, dataObj, res, db){
    var self = this;
    dataObj.currentState = stateRecord;
    db.collection('USSDSession').update({"_id" : sessionRecord._id}, { $set: dataObj}, function(err){
      if(err) throw err;
      db.collection('USSDSession').findOne({"_id" : sessionRecord._id}, function(err, sessionRecord){
        if(err) throw err;
        self.sendResponse(sessionRecord, res, db);
      });
    });
  };

  USSD.prototype.closeSession = function USSD__closeSession(sessionRecord, res, db){
    var self = this;
    db.collection('USSDSession').remove({"_id" : sessionRecord._id}, function(err){
      if(err) throw err;
      self.sendResponse({}, res, db);
    });
  };

  USSD.prototype.sendResponse = function USSD__sendResponse(jsonData, res, db){
    res.writeHead(200, "OK", {'Content-Type': 'text/plain'});
    res.write(JSON.stringify(jsonData));
    res.end();
    db.close();
  };

  return new USSD();
}());

module.exports = function (req, res) {
  var reqData;
  req.on('data', function(chunk) {
    reqData = chunk.toString();
  });
  req.on('end', function() {
    ussd.responseHandler(reqData, res);
  })
}
