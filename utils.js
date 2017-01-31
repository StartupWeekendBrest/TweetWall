var Twitter	= require('twitter'),
	printit = require('printit'),
	_		= require('lodash'),
	config	= require('./config.json'),
	t		= new Twitter({
		consumer_key: config.twitter.consumer_key,
		consumer_secret: config.twitter.consumer_secret,
		access_token_key: config.twitter.token,
		access_token_secret: config.twitter.token_secret
	}),
	log 	= printit({
		prefix: 'TweetWall::Utils',
		date: true
	});


function countPreviousTweets(hashtag, onComplete, statuses, id) {
	var until = '';
	if(id) {
		until = '&max_id='+id;
	}
	if(!statuses) {
		log.info('Crawling for tweets about ' + hashtag)
		statuses = [];
	}
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
			if(tweets.statuses.length === 100) {
				countPreviousTweets(hashtag, onComplete, statuses, tweets.statuses[99].id);
			} else {
				log.info('Retrieved ' + statuses.length + ' tweets about ' + hashtag);
				onComplete(statuses);
			}
		}
	});
}


/**************************************
	HANDLERS
**************************************/
function socketHandler(socket, state) {
	socket.join('clients');

	socket.on('disconnect', function ()
	{
		log.debug('An user disconnects');
	});

	socket.on('register', function(data){
		socket.join(data.toLowerCase());
	});

	socket.emit('battle', state.battle);

	if (state.times)
	{
		// Send the 64 latest elements to the client
		let index = Math.max(0, state.times.length - 64);
		socket.emit('rolls', state.times.slice(index, state.times.length));
	}

	log.debug('An user connects');
}


function tweetHandler(tweet, onProcessed) {
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