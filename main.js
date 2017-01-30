var Twitter = require('twitter'),
    TwitterStream = require('node-tweet-stream'),
    config  = require('./config.json'),
    twitter = new Twitter({
            consumer_key: config.twitter.consumer_key,
            consumer_secret: config.twitter.consumer_secret,
            access_token_key: config.twitter.token,
            access_token_secret: config.twitter.token_secret
    }),
    t       = new TwitterStream({
            consumer_key: config.twitter.consumer_key,
            consumer_secret: config.twitter.consumer_secret,
            token: config.twitter.token,
            token_secret: config.twitter.token_secret
    }),
    express = require('express'),
    app     = express(),
    server  = require('http').createServer(app),
    morgan  = require('morgan'),
    io      = require('socket.io')(server),
    _       = require('lodash'),
    fs      = require('fs'),
    state   = {};

if (fs.existsSync('./back.json'))
{
    state = require('./back.json');
}

/************************************************************************************************************************
 * Server Setup
 ************************************************************************************************************************/
var port = process.env.PORT || 3000;

server.listen(port, function ()
{
    console.log('Server listening at port %d', port);
});

app.use(morgan('dev'));
app.use(express.static(__dirname + '/public'));

app.use(function logErrors (err, req, res, next)
{
    console.error(err.stack);
    next(err);
});

app.use(function clientErrorHandler (err, req, res, next)
{
    if (req.xhr)
    {
        res.status(500).send({error: 'Something blew up!'});
    }
    else
    {
        next(err);
    }
});

app.use(function errorHandler (err, req, res, next)
{
    res.status(500);
    res.render('error', {error: err});
});

/************************************************************************************************************************
 * Loading config
 ************************************************************************************************************************/
config.battle = _.map(config.battle, function (hash)
{
    return hash.toLowerCase();
});

var battleCount = _.zipObject(config.battle, _.range(0, config.battle.length, 0));

_.forEach(config.battle, function (hash)
{
    t.track(hash);
});

_.extend(battleCount, state.battle);

/************************************************************************************************************************
 Looking for tweets in case back-up is empty
************************************************************************************************************************/
function countPreviousTweets(hash, statuses, id) {
  var until = '';
  if(id) {
    until = '&max_id='+id;
  }
  if(!statuses) {
    statuses = [];
  }
  var uri = 'search/tweets.json?q=%23'+hash.substring(1)+' since:'+config.battlestart+'&count=100&result_type=recent' + until;
  twitter.get(uri, function (error, tweets, response) {
    if(error) {
      console.error(error);
      process.exit();
    }
    if(tweets.statuses) {
      statuses = statuses.concat(tweets.statuses);
      if(tweets.statuses.length === 100) {
        countPreviousTweets(hash, statuses, tweets.statuses[99].id);
      } else {
        battleCount[hash] += statuses.length;
        console.log('Retrieved ' + battleCount[hash] + ' tweets for ' + hash);
        io.to('clients').emit('battle', battleCount);
      }
    }
  });
}

if(Object.keys(state).length === 0) {
  _.forEach(config.battle, function(hash) {
    countPreviousTweets(hash);
  })
}

/************************************************************************************************************************
 * App
 ************************************************************************************************************************/
io.on('connection', function (socket)
{
    socket.join('clients');

    socket.on('disconnect', function ()
    {
        console.log('a user disconnect');
    });

    socket.on('register', function(data){
        socket.join(data.toLowerCase());
    });

    socket.emit('battle', battleCount);

    if (state.times)
    {
        socket.emit('rolls', state.times.slice(Math.max(0, state.times.length - 72), state.times.length));
    }

    console.log('a user connect');
});

t.on('tweet', function (tweet)
{
  if(tweet.entities && tweet.entities.media) {
    for(var i = 0; i < tweet.extended_entities.media.length; i++) {
      var m = tweet.extended_entities.media[i];
      if(m.type === 'photo') {
        tweet.text += '<img src="' + m.media_url + '"></img>';
      } else if (m.type === 'animated_gif') {
        var video_url = m.video_info.variants[0].url;
        tweet.text += '<video src="' + video_url + '" loop autoplay />';
      }
    }
  }
    var tl = {
        text: tweet.text,
        time: tweet.timestamp_ms,
        user: {
            name: tweet.user.name,
            screen_name: tweet.user.screen_name,
            image: tweet.user.profile_image_url
        }
    };

    var lowText = tl.text.toLowerCase();

    _.forEach(config.battle, function (hash)
    {
        if (lowText.indexOf(hash) !== -1)
        {
            battleCount[hash] += 1;
            io.to(hash).emit('tweet', tl);
            io.to('clients').emit('battle', battleCount);
        }
    });

});

function autoSave ()
{
    setTimeout(function ()
    {
        fs.writeFile('./back.json', JSON.stringify(state, null, 4), function (err)
        {
            if (err)
            {
                console.log(err);
                autoSave();
            }
            else
            {
                console.log("state saved");
                autoSave();
            }
        });
    }, 60 * 1000);
}
autoSave();

function roll ()
{
    setTimeout(function ()
    {
        state.times = state.times || [];

        state.battle = _.clone(battleCount);
        state.battle._time = Math.floor(new Date().getTime() / 1000);
        state.times.push(state.battle);
        io.to('clients').emit('roll', state.battle);
        roll();
    }, 5 * 60 * 1000);
}
roll();

t.on('error', function (err)
{
    console.log('Oh no')
});
