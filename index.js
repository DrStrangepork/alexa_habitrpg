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

var api_route = "/api/v2";



var request_headers = {
  'x-api-user':  HABIT_USER,
  'x-api-key': HABIT_KEY
}

var fuzzy_search_options = {
  pre: '<'
  , post: '>'
  , extract: function(el) { return el.text; }
}

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




var handleGetAllTasksRequest = function(intent, session, response){
  request_all_tasks(function(data){
    var response_text = '';
    var number_found = 0;
    var intent_type = intent.slots.type.value.toLowerCase();
    var status = false;
    var check_status = false;
    var qualifier = '';

    if(typeof intent.slots.qualifier !== "undefined")
      check_status = true;
    
    if(check_status){
      switch(intent.slots.qualifier.value){
        case 'done':
        case 'completed':
          status = true;
          break;
        case 'not-done':
        case 'not done':
        case 'uncompleted':
        case 'not completed':
          status = false;
          break;
        default:
          check_status = false;
      }
      qualifier = intent.slots.qualifier.value;
    }

    // data.map(function(obj){
    //   if(obj.type == intent_type || intent_type == 'all' || intent_type ===''){
        // if(check_status){
        //   if(obj.completed === status){
        //     response_text += obj.text + '. '
        //     number_found++;    
        //   }
        // }else{
        //   response_text += obj.text + '. '
        //   number_found++;  
        // }
    //   }
    // });

    switch(intent.slots.type.value.toLowerCase()){
      case "habits":
        data.map(function(obj){
          if(obj.type=='habit') {

              response_text += obj.text + '.\n '
              number_found++;  
            
          }
        });
        break;
      case "dailies":
      case "dailys":
      case "daily":
        data.map(function(obj){
          if(obj.type=='daily') {
            if(check_status){
              if(obj.completed === status){
                response_text += obj.text + '. \n'
                number_found++;    
              }
            }else{
              response_text += obj.text + '.\n '
              number_found++;  
            }
          }
        });
        break;
      case "todos":
      case "todoes":
      case "to":
      case "todo":
      case "to do":
      case "to dos":
      case "to-dos":
      case "to-do":
        data.map(function(obj){
          if(obj.type=='todo') {
            if(check_status){
              if(obj.completed === status){
                response_text += obj.text + '.\n '
                number_found++;    
              }
            }else{
              response_text += obj.text + '.\n '
              number_found++;  
            }
          }
        });
        break;
      case "all":
      default:
        data.map(function(obj){
          response_text += obj.text + '.\n '
          number_found++;        
        });
    }

    if(number_found === 0){
      response_text = "I'm sorry, I found no habits that meet the criteria";
    }
    var heading = "Found " + number_found + " items for " + qualifier+ ' ' + intent.slots.type.value;
    response.tellWithCard(response_text, heading, response_text);
  })
}

var handleMarkTask = function(intent, session, response){
  request_all_tasks(function(data){
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

var HabitRPG = function(){
  AlexaSkill.call(this, APP_ID);
};

HabitRPG.prototype = Object.create(AlexaSkill.prototype);
HabitRPG.prototype.constructor = HabitRPG;

HabitRPG.prototype.eventHandlers.onSessionStarted = function(sessionStartedRequest, session){
  // What happens when the session starts? Optional
  console.log("onSessionStarted requestId: " + sessionStartedRequest.requestId
      + ", sessionId: " + session.sessionId);
};

HabitRPG.prototype.eventHandlers.onLaunch = function(launchRequest, session, response){
  // This is when they launch the skill but don't specify what they want.
  var output = 'Welcome to Habit R P G. ' +
    'Ask to mark tasks or habits to sucesss';

  var reprompt = 'What habit did you want to remark on?';

  response.ask(output, reprompt);

  console.log("onLaunch requestId: " + launchRequest.requestId
      + ", sessionId: " + session.sessionId);
};

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

exports.handler = function(event, context) {
    var skill = new HabitRPG();
    skill.execute(event, context);
};
