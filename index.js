'use strict';
require('dotenv').config();

/**
* @ TODO make all switch statements use fuzzy
*/
var http       = require('https')
  , fuzzy      = require('fuzzy')
  , AlexaSkill = require('./AlexaSkill')
  , APP_ID     = process.env.APP_ID
  , HABIT_KEY  = process.env.HABIT_KEY
  , HABIT_USER = process.env.HABIT_USER
  , BASE_URL   = process.env.BASE_URL;
var valid_qualifiers = require("./intent-slots/qualifier");
var valid_types = require("./intent-slots/type");

//define api route 
var api_route = "/api/v2";


// define request headers used for validation by HabitRPG
var request_headers = {
  'x-api-user':  HABIT_USER,
  'x-api-key': HABIT_KEY
}

// Define fuzzy_search_options for HabitTasks and intent-slots
var fuzzy_search_options = {
  pre: '<'
  , post: '>'
  , extract: function(el) { return el.text; }
}

/**
* the following options define the api routes used by HabitRPG
*/
var options_get_all_tasks = {
  host: BASE_URL,
  path: api_route + '/user/tasks',
  headers:request_headers,
  method: 'GET'
};

var options_update_task = {
  host: BASE_URL,
  path: api_route + '/user/tasks',
  headers:request_headers,
  method: 'POST'
};
/**
* END API ROUTE DEFINITIONS
*/


/**
* This function is used to create the request to HabitRPG.
* - It makes use of the options_get_all_tasks, gathers the returend JSON and passes it to the callback function.
*/
var request_all_tasks = function(callback){
  console.log("entered request_all_tasks");
    
  http.request(options_get_all_tasks, function(res) {
    var body = ''
    console.log("request recieved a response!");
    res.on('data', function(data){
      body += data;
    });

    res.on('end', function(){
      var result = JSON.parse(body);
      callback(result);
    });
  }).on('error', function(e){
    console.log('Error: ' + e);
  }).end();
}



/**
* This function is the entrypoint for GetAllTasks Intent.
* - It starts by calling request_all_tasks and passing it a callback function
* - The callback function determains if there was a qualifier (did they want only compelted? not completed?)
* - Next it determains if they wanted all, habits, todos, or dailies
* - Finally it batches up the responses before responding.
*/
var handleGetAllTasksRequest = function(intent, session, response){
  console.log("entered handleGetAllTasksRequest");
  request_all_tasks(function(data){
    console.log("entered handleGetAllTasksRequest callBack function");
    var response_text = '';
    var number_found = 0;
    var intent_type = intent.slots.type.value.toLowerCase();
    var status = false;
    var check_status = false;
    var qualifier = '';
    var fuzzy_type = 'all';

    if(typeof intent.slots.qualifier !== "undefined" && typeof intent.slots.qualifier.value !== "undefined")
      check_status = true;
    
    if(check_status){
      var qual_results = fuzzy.filter(intent.slots.qualifier.value, valid_qualifiers, fuzzy_search_options);
      if(qual_results.length > 0 && qual_results[0].score >= 12){
        status = qual_results[0].original.status;
        qualifier = qual_results[0].original.text;
      } else{
        check_status = false
      }
    } 
    var type_results = fuzzy.filter(intent.slots.type.value.toLowerCase(), valid_types, fuzzy_search_options);
    if(type_results.length > 0){
      fuzzy_type = type_results[0].original.habit_type; 
    }
    data.map(function(obj){
      if(obj.type == fuzzy_type || fuzzy_type == 'all'){
        response_text += obj.text + '.\n '
        number_found++;  
      }
    });

    if(number_found === 0){
      response_text = "I'm sorry, I found no habits that meet the criteria";
    }
    var heading = "Found " + number_found + " items for " + qualifier+ ' ' + intent.slots.type.value;
    response.tellWithCard(response_text, heading, response_text);
  })
}

/**
* This function is the entrypoint for MarkTask Intent.
* - It starts by calling request_all_tasks and passing it a callback function
* - The callback function determains the action the user wants to use
* - From there we pass the task the user mentioned into the fuzzy search against all returned tasks
* - Once fuzzy search was found complete, we perform a post request to the server to perform the action
* - Then we report to the user
*/
var handleMarkTask = function(intent, session, response){
  console.log("entered handleMarkTask");
  request_all_tasks(function(data){
    console.log("entered handleMarkTask callBack function");
    var response_text = '';
    var header = '';
    var direction = '';

    switch(intent.slots.action.value.toLowerCase()){
       case 'up':
       case 'success':
       case 'successful':
       case 'complete':
       case 'completed':
       case 'done':
       case 'did':
        direction = 'up';
       break;
       case 'notcomplete':
       case 'not complete':
       case 'notcompleted':
       case 'not completed':
       case 'down':
       case 'uncompleted':
       case 'uncomplete':
       case 'failed':
       case 'unsuccessful':
       case "didn't":
       case "did not":
        direction = 'down';
       break;
       default:
        response_text = "I'm sorry, I did not understand the request.";
        header = "No action found.";   
        response.tellWithCard(response_text, header, response_text);
    }
    if(direction.length > 0){
      var results = fuzzy.filter(intent.slots.task.value, data, fuzzy_search_options);
      if (results.length > 0){
        var id = results[0].original.id
        options_update_task.path = options_update_task.path + "/" + id + "/" + direction;

        http.request(options_update_task, function(res) {
          console.log("UPDATE request recieved a response!");
          var body= '';

          res.on('data', function(data){
            body += data;
          });

          res.on('end', function(){
            //maybe do something here eventually???
            var result = JSON.parse(body);
            header = "Request completed successfully";
            response_text = 'I successfully updated your ' + results[0].original.type;
            response.tellWithCard(response_text, header, response_text);
            // callback(result);
          });
        }).on('error', function(e){
          console.log('Error: ' + e);
        }).end()
      }
    }
    
  });
}

//Boilerplate code....
var HabitRPG = function(){
  AlexaSkill.call(this, APP_ID);
};

//Boilerplate code....
HabitRPG.prototype = Object.create(AlexaSkill.prototype);
HabitRPG.prototype.constructor = HabitRPG;

//Boilerplate code....
HabitRPG.prototype.eventHandlers.onSessionStarted = function(sessionStartedRequest, session){
  // What happens when the session starts? Optional
  console.log("onSessionStarted requestId: " + sessionStartedRequest.requestId
      + ", sessionId: " + session.sessionId);
};

//Boilerplate code....
HabitRPG.prototype.eventHandlers.onLaunch = function(launchRequest, session, response){
  // This is when they launch the skill but don't specify what they want.
  var output = 'Welcome to Habit R P G. ' +
    'Ask to mark tasks or habits to sucesss';

  var reprompt = 'What habit did you want to remark on?';

  response.ask(output, reprompt);

  console.log("onLaunch requestId: " + launchRequest.requestId
      + ", sessionId: " + session.sessionId);
};

//Boilerplate code....
//This code section defines what to do when intents are found.
HabitRPG.prototype.intentHandlers = {
  GetAllTasks: function(intent, session, response){
    handleGetAllTasksRequest(intent, session, response);
  },
  MarkTask: function(intent, session, response){
    //todo
    console.log('MarkTasks: todo');
    handleMarkTask(intent, session, response);
  },
  HelpIntent: function(intent, session, response){
    var speechOutput = 'Interact with your Habit account and Gamify your life.';
    response.ask(speechOutput);
  }
};

//Boilerplate code....
exports.handler = function(event, context) {
    var skill = new HabitRPG();
    skill.execute(event, context);
};
