var Twitter	= require('node-tweet-stream'),
	printit	= require('printit'),
	morgan	= require('morgan'),
	_		= require('lodash'),
	express = require('express'),
	app		= express(),
	server 	= require('http').createServer(app),
	io		= require('socket.io')(server),
	state	= require('./state.js'),
	utils	= require('./utils.js');


// Load config
var config  = require('./config.json');


// Modules init
var t		= new Twitter({
		consumer_key: config.twitter.consumer_key,
		consumer_secret: config.twitter.consumer_secret,
		token: config.twitter.token,
		token_secret: config.twitter.token_secret
	}),
	log 	= printit({
		prefix: 'TweetWall',
		date: true
	});


// Process battle config
config.battle = _.map(config.battle, function (hash)
{
	return hash.toLowerCase();
});

_.forEach(config.battle, function (hashtag)
{
	if(state.isEmpty(hashtag)) {
		// If we counted no tweet for a hashtag, retrieve them with the Twitter API
		utils.countPreviousTweets(hashtag, function(tweets) {
			// Once the tweets have been retrieved, notify the user to update
			// its counter
			state.updateCounter(hashtag, tweets.length);
			io.to('clients').emit('battle', state.battle);
		})
	}
	t.track(hashtag);
});


// Handlers
io.on('connection', function(socket) {
	utils.socketHandler(socket, state);
});

t.on('tweet', function(tweet) {
	utils.tweetHandler(tweet, function(hashtag, processedTweet) {
		state.updateCounter(hashtag, 1);
		// Notify the user
		io.to(hashtag).emit('tweet', processedTweet);
		io.to('clients').emit('battle', state.battle);
	});
});


// Start saving routines
state.autoSaveCurrentState();
state.autoRoll(function(battle) {
	io.to('clients').emit('roll', battle);
});


// Server Setup
var port = process.env.PORT || 3000;
var host = process.env.HOST || '0.0.0.0'

server.listen(port, host, function () {
    log.info('Server listening on ' + host + ':' + port);
});

//app.use(morgan('dev'));
app.use(express.static(__dirname + '/public'));

app.use(function logErrors (err, req, res, next) {
    console.error(err.stack);
    next(err);
});

app.use(function clientErrorHandler (err, req, res, next) {
    if (req.xhr) {
        res.status(500).send({error: 'Something blew up!'});
    }
    else {
        next(err);
    }
});

app.use(function errorHandler (err, req, res, next) {
    res.status(500);
    res.render('error', {error: err});
});
