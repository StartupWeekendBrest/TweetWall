var fs		= require('fs'),
	_		= require('lodash'),
	printit	= require('printit');

var log = printit({
	prefix: 'TweetWall::State',
	date: true
});


// Delays
const SAVE_STATE_DELAY	= 60;
const ROLL_DELAY		= 5*60;


// The app's state is all the variables containing the data on the battle
class State {

	// Initialise the object
	// @param: fileName (string)	File to read/write battls history. If the
	//								file does not exist, it will be created.
	constructor(fileName) {
		this.fileName = fileName;

		if(fs.existsSync(this.fileName)) {
			let back = require(this.fileName);
			this.times 	= back.times;
			this.battle = back.battle;
		} else {
			this.times 	= [];
			this.battle = {};
		}
		for(let hashtag of require('./config.json').battle) {
			if(!this.battle[hashtag]) {
				this.battle[hashtag] = 0;
			}
		}
	}


	// Periodically write the battle state in the history file
	autoSaveCurrentState() {
		setTimeout(() => {
			let state = {
				times: this.times,
				battle: this.battle
			};
			let stateStr = JSON.stringify(state, null, 4);
			fs.writeFile(this.fileName, stateStr, (err) => {
				if (err) {
					log.error(err);
				}
				else {
					log.info('Saved');
				}
				this.autoSaveCurrentState();
			});
		}, SAVE_STATE_DELAY * 1000);
	}


	// Periodically save the current battle state so we can compare it with the
	// other saves
	autoRoll(onRolled) {
		setTimeout(() => {
			this.battle._time = Math.floor(new Date().getTime() / 1000);
			this.times.push(_.clone(this.battle));

			log.debug('Rolled state');
			onRolled(this.battle);

			this.autoRoll(onRolled);
		}, ROLL_DELAY * 1000);
	}


	// Update the counter for a given hashtag, adding a given amount to it
	// @param: hashtag (string) The hashtag to update the counter of
	// @param: amount (integer) The ammount to add to the counter
	updateCounter(hashtag, amount) {
		this.battle[hashtag] += amount;
	}


	// Indicates if the counter for a given hashtag is null
	// @param: hashtag (string) Hashtag to check the counter of
	// @return:	true if the counter equals to 0
	//			false if the counter is set to a non-null value
	isEmpty(hashtag) {
		return (!this.battle || !this.battle[hashtag]);
	}
}

module.exports = (new State('./back.json'));
