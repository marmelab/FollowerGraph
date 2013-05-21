var Twit    = require('twit');
var async   = require('async');
var fs      = require('fs');
var dataDir = __dirname + '/../public/data/';

var DataRetriever = function(config){
	this.client = new Twit({
		consumer_key:         config.consumer_key,
		consumer_secret:      config.consumer_secret,
		access_token:         config.access_token,
		access_token_secret:  config.access_token_secret
	});
};

DataRetriever.prototype.retrieveAndStoreData = function(idUser, cb){
	var self        = this;
	var oAllIds     = {};

	// Create data folder if needed
	if(!fs.existsSync(dataDir)){
		fs.mkdirSync(dataDir, 0775);
	}

	// Retrieve followers & following of the current user
	async.waterfall([
		function(next){
			self.retrieveAndStoreLinksFor(idUser, function(err, res){
				if(err){
					return cb(err);
				}

				oAllIds[idUser] = idUser;

				// Store all ids
				for(var i = 0, length = res.followers.length; i <length; i++ ){
					var idFollower = res.followers[i];

					oAllIds[idFollower] = idFollower;
				}
				for(var i = 0, length = res.followings.length; i <length; i++ ){
					var idFollowing = res.followings[i];

					oAllIds[idFollowing] = idFollowing;
				}

				next(null, oAllIds);
			});
		},

		function(oAllIds, next){
			// Retrieve data of the followers & followings of the current user
			self.retrieveDataFor(Object.keys(oAllIds), function(err, res){
				if(err){
					return cb(err);
				}

				var oOtherIds       = {};
				var aIdsToRetrieve  = Object.keys(res);
				var nbToRetrieve    = aIdsToRetrieve.length;
				var current         = 0;

				// Retrieve links for others users
				(function retrieveOthersLinks(){
					// No more data to retrieve -> return the list of all retrieved ids
					if(current == nbToRetrieve){
						return next(null, oAllIds, oOtherIds);
					}

					// Retrieve next data
					var idToRetrieve = aIdsToRetrieve[current];

					// If the current user has more than 15000 followers or followings, skip
					if(res[idToRetrieve].followers_count > 15000 || res[idToRetrieve].friends_count > 1500){
						console.log('Skip : '+res[idToRetrieve].screen_name+' (followers : '+res[idToRetrieve].followers_count+')');

						current++;
						return retrieveOthersLinks();
					}

					self.retrieveAndStoreLinksFor(idToRetrieve, function(err, res){
						if(err){
							return cb(err);
						}

						// Store all ids
						for(var i = 0, length = res.followers.length; i <length; i++ ){
							var idFollower = res.followers[i];

							oOtherIds[idFollower] = idFollower;
						}
						for(var i = 0, length = res.followings.length; i <length; i++ ){
							var idFollowing = res.followings[i];

							oOtherIds[idFollowing] = idFollowing;
						}

						current++;
						retrieveOthersLinks();
					});
				})();
			});
		},

		function (oAllIds, oOtherIds, next){
			// Retrieve others data
			self.retrieveDataFor(Object.keys(oOtherIds), function(err, otherRslt){
				if(err){
					return cb(err);
				}

				for(var z in otherRslt){
					oAllIds[z] = otherRslt[z];
				}

				next(null, oAllIds);
			});
		},

		function (oAllIds, next){
			self.saveData('data', oAllIds, next);
		}
	], cb);
};

DataRetriever.prototype.retrieveAndStoreLinksFor = function(idUser, cb){
	console.log('Retrieving followers/followings for :'+idUser);

	var self = this;

	// Retrieve followers & followings for the current user
	this.retrieveLinksFor(idUser, function(err, followers, followings){
		if(err){
			return cb(err);
		}

		// Store data of the first user
		var oData = {
			followers   : followers,
			followings  : followings
		};

		self.saveData(idUser, oData);
		cb(null, oData);
	});
}

DataRetriever.prototype.saveData = function(fileName, data){
	fs.writeFileSync(dataDir+fileName+'.json', JSON.stringify(data));
}

DataRetriever.prototype.retrieveLinksFor = function(idUser, cb){
	var self = this;

	async.waterfall([
		function(next){
			// Retrieve followers
			self.callWithPagination('get', 'followers/ids', {user_id: idUser}, function(err, res){
				if(err){
					return next(err);
				}

				next(null, res);
			});
		},

		function(followersId, next){
			// Retrieve followings
			self.callWithPagination('get', 'friends/ids', {user_id: idUser}, function(err, res){
				if(err){
					return next(err);
				}

				next(null, followersId, res);
			});
		}

	], cb);
};

DataRetriever.prototype.retrieveDataFor = function(aUserIds, cb){
	var nbIds         = aUserIds.length;
	var currentPage   = 1;
	var itemsPerCall  = 100;
	var usersData     = {};
	var self          = this;

	if(nbIds == 0){
		return cb(null, []);
	}

	console.log('Retrieve users data');
	console.log('Nb to retrieve : '+nbIds);
	(function usersLookup(){
		var currentPos = (currentPage - 1) * itemsPerCall;
		console.log('Pos : '+currentPos);

		if(currentPos >= nbIds){
			return cb(null, usersData);
		}

		var sIds = aUserIds.slice(currentPos, currentPos + itemsPerCall).join(',');

		self.client.get('users/lookup', {user_id: sIds}, function(err, datas){
			if(err){
				return cb(err);
			}

			for(var i = 0, length = datas.length; i < length; i++){
				var data = datas[i];

				usersData[data.id_str] = data;
			}

			currentPage++;
			usersLookup();
		});
	})();
}

DataRetriever.prototype.callWithPagination = function(method, url, params, cb){
	var self      = this;
	var results   = [];


	(function processCall(method, url, params, cursor){
		params.cursor = cursor || -1;

		console.log('Call :'+url+' ('+JSON.stringify(params)+')');
		self.client[method](url, params, function(err, res){
			if(err){
				//return cb(err);
			}else{
				results = results.concat(res.ids);
			}

			if(!res || res.next_cursor == 0){
				cb(null, results);
			}else{
				processCall(method, url, params, res.next_cursor);
			}
		});
	})(method, url, params);

}

module.exports = DataRetriever;