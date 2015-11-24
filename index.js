var assert = require('assert');
var fs = require('fs');
var Hapi = require('hapi');
var Boom = require('boom');
var Joi = require('joi');
var Wreck = require('wreck');

var winston = require('winston');

winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {
  level: 'debug'
});
winston.add(winston.transports.File, {
  filename: './diceroller.log',
  level: 'info'
});

var server = new Hapi.Server();
server.connection({ port: 4617, host: '127.0.0.1' });
server.register(require('inert'), function() {});

var rollSchema = Joi.object().keys({
  token: Joi.string().required(),
  team_id: Joi.string().required(),
  team_domain: Joi.string().required(),
  channel_id: Joi.string().required(),
  channel_name: Joi.string().required(),
  user_id: Joi.string().required(),
  user_name: Joi.string().required(),
  command: Joi.string().required(),
  text: Joi.string().required(),
  response_url: Joi.string()
});

var teamsSchema = Joi.array().items(
  Joi.object().keys({
    teamName: Joi.string().required(),
    token: Joi.string().required()
  })
);

try {
  var teamJson = JSON.parse(fs.readFileSync('teams.json'));
} catch(err) {
  console.log('Error reading or parsing file: ' + err);
  process.exit(1);
}

teamsSchema.validate(teamJson, function(err, value) {
  if (err) {
    console.log('Schema error: ' + err);
    process.exit(2);
  }
});

var teamTokens = {};
var teamNames = {};

teamJson.forEach(function(team) {
  teamTokens[team.token] = true;
  // Team name isn't really used for anything, it just decorates the data file.
  teamNames[team.token] = team.teamName;
});

var math = [
  {
    '*': function(a,b) { return a * b; },
    '/': function(a,b) { return a / b; }
  }, {
    '+': function(a,b) { return a + b; },
    '-': function(a,b) { return a - b; }
  }
];

function roll(dieStr, user) {
  var diff = null;
  if (dieStr.match('diff')) {
    diff = parseInt(dieStr.split('diff')[1], 10);
    dieStr = dieStr.split('diff')[0];
  }
  return {
    diff: diff,
    dice: dieStr.split('d').reduce(function (dice, sides) {
      dice = parseInt(dice, 10);
      sides = parseInt(sides, 10);

      assert(dice < 31, 'too many dice');
      assert(sides < 1001, 'too many sides on the dice');

      var rolls = [];

      for (var i = 0; i < dice; i++) {
        var value = Math.floor(sides * Math.random() + 1);

        rolls.push(value);
      }

      return rolls;
    })
  };
}

function tokenize(str) {
  str = str.replace(/\s/g, '').toLowerCase();
  var intMatch = /^\d+$/;
  var diceMatch = /^([0-9]+(?:d[0-9]+)?)(diff\d+)?([\+\-\/\*]?)/;
  var more, token, tokens = [];
  token = diceMatch.exec(str);

   while (token) {
    if (token[1].match(intMatch)) {
      tokens.push(parseInt(token[1], 10));
    } else {
      if (token[2]) {
        tokens.push(token[1] + token[2]);
      } else {
        tokens.push(token[1]);
      }
    }

    if (token[3]) {
      tokens.push(token[3]);
      str = str.replace(token[0], '');
      token = diceMatch.exec(str);
      if (!token) {
        tokens.pop();
      }
    } else {
      token = null;
    }
  }

  return tokens;
}

server.route([{
  method: 'GET',
  path: '/{param*}',
  handler: {
    directory: {
      path: 'static',
      redirectToSlash: true,
      index: true
    }
  }
},{
  method: 'POST',
  path: '/roll',
  config: {
    validate: {
      payload: rollSchema
    }
  },
  handler: function (request, reply) {
    var p = request.payload;
    var responseUrl = p.response_url;

    if (teamTokens[p.token] !== true) {
      winston.error({error: 'token not found', payload: p});
      return reply(Boom.badRequest('Token not found.'));
    }
    delete(p.token);
    delete(p.response_url);

    if (p.command != '/roll') {
      winston.error({error: 'command not found', payload: p});
      return reply(Boom.badRequest('Command not supported.'));
    }

    if (p.text.length > 60) {
      winston.error({error: 'text too long', payload: p});
      return reply(Boom.badRequest('Dice string is too long.'));
    }

    p.team_name = teamNames[p.team_id];

    var i, rolls, wreckText;
    var diceArray = tokenize(p.text);
    var diceValues = [];
    var total = [];

    try {
      diceArray.forEach(function(token) {
        if (token.match && token.match(/d/)) {
          rolls = roll(token, p.user_name);
          if (rolls.diff !== null) {
            var successes = rolls.dice.reduce(function(a, b) {
              if (b == 1) {
                return a - 1;
              } else if (b < rolls.diff) {
                return a;
              } else {
                return a + 1;
              }
            }, 0);
            total.push(successes);
            var successText = successes == 1 ? ' success' : ' successes';
            diceValues.push('[' + rolls.dice.join(',') + '] diff ' +
                rolls.diff + ' with ' + successes + successText);
          } else {
            total.push(rolls.dice.reduce(function(a, b) {
              return a + b;
            }, 0));
            diceValues.push(rolls.dice);
          }
        } else {
          diceValues.push(token);
          total.push(token);
        }
      });
    } catch(err) {
      winston.error({error: 'too many dice in a group', payload: p});
      return reply(Boom.badRequest(
          'You seem to have rolled way too many dice.'));
    }

    math.forEach(function(ops) {
      for (i = 0; i < total.length; i++) {
        if (ops[total[i]]) {
          total[i - 1] =
              ops[total[i]](total[i - 1], total[i + 1]);
          total = total.slice(0,i).concat(total.slice(i + 2, total.length));
          i--;
        }
      }
    });

    total = total.length ? total[0] : 0;

    diceValues.forEach(function(value, i, arr) {
      if (value instanceof Array) {
        arr[i] = '[' + value.join() + ']';
      }
    });

    wreckText = '@' + p.user_name + ' rolled: ' + diceArray.join(' ') +
        '\nResulting in ' + diceValues.join(' ') +
        ' for a total of: ' + total;

    if (wreckText.length > 500) {
      winston.error({error: 'response too long', payload: p});
      return reply(Boom.badRequest(
          'You seem to have rolled way too many dice.'));
    }

    winston.info({diceArray: diceArray, diceValues: diceValues, payload: p});

    if (diceValues.length) {
      Wreck.post(responseUrl, {
        payload: JSON.stringify({
          "response_type": "in_channel",
          "text": wreckText
        })
      }, function(err, response, payload) {
        if (err) {
          winston.error({
            wreckError: err,
            error: 'wreck request to slack failed',
            payload: p
          });
        }
      });
      reply();
    } else {
      reply(Boom.badRequest('Command text did not seem to contain a ' +
          'vaild dice string.'));
    }
  }
}]);

server.start(function () {
  winston.info('\n\nServer running at:', server.info.uri);
});
