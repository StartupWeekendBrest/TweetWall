var Twitter	= require('twitter'),
	printit = require('printit'),
	_		= require('lodash'),
	config	= require('./config.json'),
	// Twitter API Client
	t		= new Twitter({
		consumer_key: config.twitter.consumer_key,
		consumer_secret: config.twitter.consumer_secret,
		access_token_key: config.twitter.token,
		access_token_secret: config.twitter.token_secret
	}),
	// Logging
	log 	= printit({
		prefix: 'TweetWall::Utils',
		date: true
	});


// Request the Twitter API to get all tweets with a given hashtag. It will
// retrieve tweets in an non-chronological order: from the most recent to the
// older.
// @param: hashtag (string) Hashtag
// @param: onComplete (function) Callback (called with an array of tweets)
// @param: statuses (array) Tweets collected so far (used in the recursive call)
// @param: id (integer) ID of the older tweet retrieved
function countPreviousTweets(hashtag, onComplete, statuses, id) {
	var until = '';
	if(id) { // Only executed from the 2nd recursive call
		until = '&max_id='+id;
	}
	if(!statuses) { // First call: Log & init
		log.info('Crawling for tweets about ' + hashtag)
		statuses = [];
	}
	// Max counter allowed is 100
	var uri = 'search/tweets.json?q=%23'+hashtag.substring(1)+' since:'+config.battlestart+'&count=100&result_type=recent' + until;
	t.get(uri, function (error, tweets, response) {
		if(error) {
			// If there's an API error: We log it and return with the statuses
			// collected so far
			log.error(error);
			onComplete(statuses);
			return;
		}
		if(tweets.statuses) {
			statuses = statuses.concat(tweets.statuses);
			// As the max number of tweets allowed in a request is 100, if we 
			// receive exactly 100 tweets, it means there's more tweets to
			// retrieve, so we call the function recursively with a max tweet id
			if(tweets.statuses.length === 100) {
				countPreviousTweets(hashtag,
									onComplete,
									statuses,
									tweets.statuses[99].id);
			} else {
				log.info('Retrieved '+statuses.length+' tweets about '+hashtag);
				onComplete(statuses);
			}
		}
	});
}


/**************************************
	HANDLERS
**************************************/
// Socket.IO's socket handler, defines what will happen when an user connects
// @param: socket (object) Socket.IO socket object
// @param: state (object) The State object used in the main app
function socketHandler(socket, state) {
	socket.join('clients');

	socket.on('disconnect', function () {
		log.debug('An user disconnects');
	});

	// The user registers to a specific hashtag's feed 
	// (ex: http://localhost:3000/#gif)
	socket.on('register', function(data){
		socket.join(data.toLowerCase());
	});

	// Emit the current battle's status
	socket.emit('battle', state.battle);

	if(state.times) {
		// Send the 64 latest saves to the client (or less if there isn't 64
		// saves) if there's at least one (if the app was run before)
		let index = Math.max(0, state.times.length - 64);
		socket.emit('rolls', state.times.slice(index, state.times.length));
	}

	log.debug('An user connects');
}


// Tweets handler called whenever a tweet is received
// @param: tweet (object) Tweet from the Twitter API
// @param: onProcessed (function) Callback (called with the hashtag and tweet)
function tweetHandler(tweet, onProcessed) {
	// Process attached media
	if(tweet.entities && tweet.entities.media) {
		for(var i = 0; i < tweet.extended_entities.media.length; i++) {
			// tweet.extended_entities contains more data than tweet.entities
			// included the media type
		  	var m = tweet.extended_entities.media[i];
			if(m.type === 'photo') {
				tweet.text += '<img src="' + m.media_url + '"></img>';
			} else if (m.type === 'animated_gif') {
				// Twitter GIF are actually MP4 videos
				var video_url = m.video_info.variants[0].url;
				tweet.text += '<video src="' + video_url + '" loop autoplay />';
			}
		}
	}

	// Formatted tweet
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

	// Check if the tweet contains one of the battle's hashtag
	_.forEach(config.battle, function (hashtag) {
		if (lowText.indexOf(hashtag) !== -1) {
			onProcessed(hashtag, tl);
		}
	});
}

module.exports = {
	countPreviousTweets,
	socketHandler,
	tweetHandler
};