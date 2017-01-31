var fs		= require('fs'),
	_		= require('lodash'),
	printit	= require('printit');

var log = printit({
	prefix: 'TweetWall::State',
	date: true
});

// Parameters
const SAVE_STATE_DELAY	= 60;
const ROLL_DELAY		= 5*60;

class State {
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
					log.debug('Saved');
				}
				this.autoSaveCurrentState();
			});
		}, SAVE_STATE_DELAY * 1000);
	}
	
	autoRoll(onRolled) {

		setTimeout(() => {
			this.battle._time = Math.floor(new Date().getTime() / 1000);
			this.times.push(_.clone(this.battle));
			
			log.debug('Rolled state');
			onRolled(this.battle);

			this.autoRoll(onRolled);
		}, ROLL_DELAY * 1000);
	}
	
	updateCounter(hashtag, amount) {
		this.battle[hashtag] += amount;
	}
	
	isEmpty(hashtag) {
		return (!this.battle || !this.battle[hashtag]);
	}
}

module.exports = State;