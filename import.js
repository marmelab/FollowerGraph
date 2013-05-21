var config        = require('config');
var fs            = require('fs');
var DataRetriever = require('./models/DataRetriever');

var dataRetriever = new DataRetriever(config.twitter);
dataRetriever.retrieveAndStoreData(config.application.userId, function(err, allIds){
	if(err){
		return console.log(err);
	}

	console.log('Done !');
});