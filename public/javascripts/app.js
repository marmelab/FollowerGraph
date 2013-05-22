var width               = window.innerWidth;
var height              = window.innerHeight;
var biDirectionalForce  = 10;
var followingForce      = 8;
var followedForce       = 4;
var colors              = d3.scale.category20();
var currentUserId       = 14089153;
var nodes               = [];
var links               = [];
var currentCard         = null;

var force = d3.layout.force()
		.charge(-120)
		.distance(300)
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

	// Raw data of the display node
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

	// Parse each nodes
	for(var idUser in rawNodes){
		// Create node
		nodes.push({
			name:       data[idUser] ? '@'+data[idUser].screen_name : 'Anonymous',
			fullname:   data[idUser] ? data[idUser].name : '',
			image :     data[idUser] ? data[idUser].profile_image_url_https : 'https://si0.twimg.com/sticky/default_profile_images/default_profile_4_bigger.png',
			id:         idUser,
			group:      idUser == currentUserId ? 1 : 2,
			followers:  data[idUser] ? data[idUser].followers_count : 0,
			followings: data[idUser] ? data[idUser].friends_count : 0
		});

		aNodeMap[idUser] = nodes.length - 1;
	}

	// Add links between nodes
	for(var idUser in rawNodes){

		// Do not display current user links
		if(idUser == currentUserId){
			continue;
		}

		var oNode         = rawNodes[idUser];
		var sourceIndex   = aNodeMap[idUser];

		// Add followers & followings links
		var aLinkDatas = [oNode.followers, oNode.followings];

		for(var i = 0, dataLength = aLinkDatas.length; i < dataLength; i++){
			var aLink = aLinkDatas[i];

			// Parse each type of link (followers / followings)
			for(var j = 0, length = aLink.length; j < length; j++){
				var idElement = aLink[j];

				// Do not display current user links
				if(idElement == currentUserId){
					continue;
				}

				// Check if the link point to an existing node
				var destIndex = aNodeMap[idElement];
				if(!destIndex){
					continue;
				}

				var isFollower = oNode.followers.indexOf(parseInt(idElement, 10)) > -1;
				var isFollowing = rawNodes[idElement].followers.length ? rawNodes[idElement].followers.indexOf(parseInt(idUser, 10)) > -1 : false;

				var val = followedForce;
				if(isFollower && isFollowing){
					val = biDirectionalForce;
				}else if(isFollowing){
					val = followingForce;
				}

				// Create links if we have source & destination node
				links.push({
					source: sourceIndex,
					target: destIndex,
					value: val
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
			.style("stroke-width", function(d) { return (d.value /100); })
			.style("stroke-opacity", function(d) { return (d.value *10); });

	var node = svg.selectAll(".node")
			.data(nodes)
			.enter().append("g")
			.attr("class", "node")
			.attr('id', function(d){ return 'node-'+d.id});

	node
			.append("image")
			.attr("xlink:href", function(d){ return d.image })
			.attr('width', 48)
			.attr('height', 48)
			.attr('x', -24)
			.attr('y', -24)
			.attr('style', 'clip-path: url(#clipCircle);')
			.attr('transform', 'scale(0.6 0.6)')
			.call(force.drag);

	node.on('click', function(e, f){
		displayCard(e);
	});

	force.on("tick", function() {
		// Move graph on tick
		link.attr("x1", function(d) { return d.source.x; })
				.attr("y1", function(d) { return d.source.y; })
				.attr("x2", function(d) { return d.target.x; })
				.attr("y2", function(d) { return d.target.y; });

		node.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });

		if(currentCard){
			// Also move card if needed
			currentCard.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")" });
		}
	});

	svg.on('click', function(){
		if(!currentCard){
			return;
		}

		// Retrieve current card dimension & position
		var rect = currentCard.select('rect')[0][0];
		var pos = d3.mouse(rect);

		// Have we clicked outside the current card ?
		if(pos[0] < -24 || pos[1] < -24 || pos[0] > rect.attributes.width.value || pos[1] > rect.attributes.height.value){
			removeCard();
		}
	});
}

/**
 * Hide current card
 */
function removeCard(){
	if(currentCard){
		// Remove image
		currentCard.select('image')
				.transition()
				.attr('style', 'clip-path: url(#clipCircle);')
				.attr('transform', 'scale(0.6 0.6)')
				.ease("out")
				.duration(1000)
				.each("end", function() {
					this.remove();
				});

		// Remove texts
		currentCard.selectAll('text, rect')
				.attr('style', 'opacity: 1')
				.transition()
				.attr('style', 'opacity: 0')
				.ease("out")
				.duration(1000)
				.each("end", function() {
					this.remove();
				});

		currentCard = null;
	}
}

/**
 * Display a twitted card for the clicked node
 * @param Object element
 */
function displayCard(element){
	// Remove previous card
	removeCard();

	var idUser      = element.id;
	var currentNode = d3.select('#node-'+idUser);
	if(!currentNode.length){
		return;
	}

	// Add a group which will contains the card
	currentCard = svg
			.data([element])
			.append('g')
			.attr('class', 'card')
			.attr("transform", "translate(" + element.x + "," + element.y + ")");

	// Image animation
	currentCard
			.append("image")
			.attr("xlink:href", element.image)
			.attr('width', 48)
			.attr('height', 48)
			.attr('x', -24)
			.attr('y', -24)
			.attr('style', 'clip-path: url(#clipCircle);')
			.attr('transform', 'scale(0.6 0.6)')
			.transition()
			.ease("elastic")
			.duration(1000)
			.attr('style', 'clip-path: none')
			.attr('transform', 'scale(1 1)');

	var bg = currentCard
			.append("rect")
			.attr('fill', '#fff');

	// Add centered text
	var texts = [element.name, element.fullname, element.followers+' abonnés, '+ element.followings+ ' abonnements'];
	var yText = 30;
	var maxWidth = 0;
	for(var i = 0, length = texts.length; i < length; i++){
		var text = texts[i];

		// Add Text
		var textElt = currentCard
				.append('text')
				.text(text);

		// Retrieve text dimensions
		var textWidth   = textElt[0][0].offsetWidth;
		var textHeight  = textElt[0][0].offsetHeight
		maxWidth        = Math.max(maxWidth, textWidth);

		textElt
				.attr('x', -textWidth/2)
				.attr('y', yText + textHeight);

		yText += textHeight;
	}

	maxWidth += 20;

	// Change the background dimensions depending of the texts
	bg.attr('x', -maxWidth / 2)
			.attr('y', 25)
			.attr('width', maxWidth)
			.attr('height', yText)
}