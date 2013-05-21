var width               = 900;
var height              = 600;
var biDirectionalForce  = 10;
var followingForce      = 8;
var followedForce       = 4;
var colors              = d3.scale.category20();
var currentUserId       = 1153172437;

var force = d3.layout.force()
		.charge(-120)
		.linkDistance(30)
		.size([width, height]);

// Create SVG
var svg = d3.select("#container").append("svg")
		.attr("width", width)
		.attr("height", height);

// Retrieve all nodes files
d3.json('/nodes', function(err, files){
	if(err){
		return console.error(err);
	}

	var rawNodes = {};
	var nbFiles  = files.length;
	var current  = 0;

	// Retrieve each file data
	(function retrieveLinks(){
		if(current >= nbFiles){
			//Retrieve data
			d3.json('/data/data.json', function(err, data){
				if(err){
					return console.log(err);
				}

				return displayGraph(rawNodes, data);
			});

			return;
		}

		var file = files[current];
		var userId = file.split('.')[0];

		// Retrieve node links (followers + followings)
		d3.json('/data/'+userId+'.json', function(err, links){
			if(err){
				return console.log(err);
			}

			rawNodes[userId] = links;
			current++;
			retrieveLinks();
		});
	})();
});

function displayGraph(rawNodes, data){
	var aNodeMap  = {};
	var nodes     = [];
	var links     = [];


	// Parse each nodes
	for(var idUser in rawNodes){
		// Create node
		nodes.push({
			name: data[idUser].screen_name,
			id: idUser,
			group: idUser == currentUserId ? 1 : 2
		});

		aNodeMap[idUser] = nodes.length - 1;
	}

	// Add links
	for(var idUser in rawNodes){
		var oNode         = rawNodes[idUser];
		var sourceIndex   = aNodeMap[idUser];

		// Add followers & followings links
		var aLinkDatas = [oNode.followers, oNode.followings];

		for(var i = 0, dataLength = aLinkDatas.length; i < dataLength; i++){
			var aLink = aLinkDatas[i];

			// Parse each type of link (followers / followings)
			for(var j = 0, length = aLink.length; j < length; j++){
				var idElement = aLink[j];

				// Check if the link point to an existing node
				var destIndex = aNodeMap[idElement];
				if(!destIndex){
					continue;
				}

				// Create links if we have source & destination node
				links.push({
					source: sourceIndex,
					target: destIndex,
					value: 1
				});
			}
		}
	}

	// Create d3js force directed graph
	force
			.nodes(nodes)
			.links(links)
			.start();

	var link = svg.selectAll(".link")
			.data(links)
			.enter().append("line")
			.attr("class", "link")
			.style("stroke-width", function(d) { return (d.value / 2); });

	var node = svg.selectAll(".node")
			.data(nodes)
			.enter().append("circle")
			.attr("class", "node")
			.attr("r", 5)
			.style("fill", function(d) { return colors(d.group); })
			.call(force.drag);

	node.append("title")
			.text(function(d) { return d.name; });

	node.on('click', function(e){
		console.log(e.id+':'+e.name);
	});

	force.on("tick", function() {
		link.attr("x1", function(d) { return d.source.x; })
				.attr("y1", function(d) { return d.source.y; })
				.attr("x2", function(d) { return d.target.x; })
				.attr("y2", function(d) { return d.target.y; });

		node.attr("cx", function(d) { return d.x; })
				.attr("cy", function(d) { return d.y; });
	});
}