var fs = require('fs');
/*
 * GET node listing.
 */

exports.list = function(req, res){
	// List all files
	var dir = __dirname + '/../public/data';

	fs.readdir(dir, function(err, files){
		if(err){
			res.status(500);
			return res.send(err);
		}

		var aResult = [];

		console.log(files);
		for(var i = 0, length = files.length; i < length; i++){
			var file = files[i];

			if(file != 'data.json' && file.split('.')[0].length){
				aResult.push(files[i]);
			}
		}

		res.send(aResult);
	});

};