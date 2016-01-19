Players = new Mongo.Collection("players");
Game = new Mongo.Collection("game");

/* CLIENT */

if (Meteor.isClient) {
	
	/* Session.setDefaults */
	
	Session.setDefault("playerID", null);
	Session.setDefault("game", {state: "inLobby"});
	Session.set("currentView", "startMenu");
	
	/* Helper Functions */
	
	function getGame() {
		return Game.find().fetch()[0];
	}
	
	function getPlayer() {
		var playerID = Session.get("playerID");
		return Players.findOne(playerID);
	}
	
	/* Tracker */
	
	Tracker.autorun(function() {
		var game = getGame();
		if(game){
			//check go to game view
			if(game.state === "inGame"){
				Session.set("currentView", "gameView");
				
				//check go to voting
				if(game.gameState == "voting"){
					document.getElementById("vote-results").style.display = "none";
					document.getElementById("pass-results").style.display = "none";
					document.getElementById("voting").style.display = "block";
				}
				
				//check done voting
				var numPlayers = Players.find({}).count();
				if(game.numApprove + game.numReject === numPlayers ) {
					document.getElementById("approve").style.backgroundColor = "grey";
					document.getElementById("reject").style.backgroundColor = "grey";
					document.getElementById("voting").style.display = "none";
					document.getElementById("vote-results").style.display = "block";
					if(game.numApprove > numPlayers/2){
						document.getElementById("pass-fail").style.display = "block";
						if(!getPlayer().innocent && getPlayer().picked){
							document.getElementById("fail").style.display = "inline";
						}
						if(Session.get("playerID") === Players.find().fetch()[game.round]._id){
							Meteor.call("approveVote");
						}
					} else {
						document.getElementById("picking").style.display = "block";
						if(Session.get("playerID") === Players.find().fetch()[game.round]._id){
							Meteor.call("rejectVote");
						}
					}
				}
				
				//check reached max failed votes
				if(game.failedVotes == 5 || game.numRoundsFail == 3){
					if(Session.get("playerID") === Players.find().fetch()[game.round]._id)
					Meteor.call("gameOver", false);
					Session.set("currentView", "gameOver");
				}
				
				//check game over
				if(game.numRoundsPass == 3){
					if(Session.get("playerID") === Players.find().fetch()[game.round]._id)
					Meteor.call("gameOver", true);
					Session.set("currentView", "gameOver");
				}
				
				//check done passing
				var numPassing = game.missionNums[game.round];
				if(game.numPass + game.numFail === numPassing) {
					if(getPlayer().picked){
						document.getElementById("pass").style.backgroundColor = "grey";
						document.getElementById("fail").style.backgroundColor = "grey";
					}
					document.getElementById("pass-fail").style.display = "none";
					document.getElementById("vote-results").style.display = "none";
					document.getElementById("picking").style.display = "block";
					document.getElementById("pass-results").style.display = "block";
					if(Session.get("playerID") === Players.find().fetch()[game.round]._id){
						if(game.numFail === 0){
							Meteor.call("passMission", true);
						} else {
							Meteor.call("passMission", false);
						}
					}
				}
			}
		}
	});
	
	/* window functions */
	
	window.onbeforeunload = function(event) {
		var playerID = Session.get("playerID");
		Meteor.call("resetUserState", playerID);
		Session.set("playerID", null);
	};
	
	/* Template - body */
	
	Template.body.helpers({
		whichView: function() {
			return Session.get("currentView");
		}
	});
	
	/* Template - startMenu */
	Template.startMenu.events({
		"submit #join-game": function (event) {
			
			var playerName = event.target.playerName.value;
			
			Meteor.call("createPlayer", playerName, function(err, playerID){
				Session.set("playerID", playerID);
			});
			
			event.target.playerName.value = "";
			
			Session.set("currentView", "lobby");
			
			return false;
		}
	});
	
	/* Template - lobby */
	
	Template.lobby.helpers({
		players: function () {
			return Players.find({});
		}
	});
	
	Template.lobby.events({
		"click .leave-game": function () {
			var playerID = Session.get("playerID");
			Meteor.call("resetUserState", playerID);
			Session.set("playerID", null);
			Session.set("currentView", "startMenu");
		},
		
		"click .start-game": function () {
			var players = Players.find({});
			var numPlayers = players.count();
			if(numPlayers >= 5 && numPlayers <= 10){
				Meteor.call("setupGame", numPlayers);
			} else {
				alert("Need 5-10 players to play");
			}
		}
	});
	
	/* Template - gameView */
	
	Template.gameView.helpers({
		players: function () {
			return Players.find({});
		},
		
		isInnocent: function() {
			return getPlayer().innocent;
		},
		
		traitors: function () {
			var playerName = getPlayer().name;
			return Players.find({
				$and: [
					{ innocent: {$ne: true} },
					{ name: {$ne: playerName} }
				]
			});
		},
		
		pickedPlayers: function() {
			return Players.find({ picked: true });
		},
		
		isPicked: function() {
			return getPlayer().picked;
		},
		
		isTurn: function () {
			console.log("isTurn");
			console.log(getGame().turn);
			console.log(getPlayer().turn);
			return getPlayer().turn;
		},
		
		missionNum: function() {
			return getGame().missionNums[getGame().round];
		},
		
		approveVote: function() {
			return getGame().gameState === "passing";
		},
		
		missionResults: function() {
			return getGame().missionResults.slice(0,getGame().round);
		},
		
		getRound: function() {
			return getGame().round;
		},
		
		getPlayer: function() {
			return getPlayer();
		},
		
		getGame: function() {
			return getGame();
		}
	});
	
	Template.gameView.events({
		"click .player-button": function(event) {
			var playerID = this._id;
			var player = Players.findOne(playerID);
			var game = getGame();
			if(!player.picked) {
				if(game.numPicked < game.missionNums[game.round]) {
					Meteor.call("updatePicked", player);
					event.target.style.backgroundColor = "green";
				}
			} else {
				Meteor.call("updatePicked", player);
				event.target.style.backgroundColor = "grey";
			}
		},
		
		"click .submit-button": function() {
			var game = getGame();
			var players = Players.find({});
			if(game.numPicked === game.missionNums[game.round]){
				var pbs = document.getElementsByClassName("player-button");
				for(var i = 0; i < pbs.length; i++){
					pbs[i].style.backgroundColor = "grey";
				}
				document.getElementById("picking").style.display = "none";
				Meteor.call("submitPick");
			}
		},
		
		"click .approve": function(event) {
			if(!getPlayer().voted){
				event.target.style.backgroundColor = "green";
				Meteor.call("vote", getPlayer(), true);
			}
		},
		
		"click .reject": function(event) {
			if(!getPlayer().voted){
				event.target.style.backgroundColor = "green";
				Meteor.call("vote", getPlayer(), false);
			}
		},
		
		"click .pass": function(event) {
			if(!getPlayer().passed){
				event.target.style.backgroundColor = "green";
				Meteor.call("pass", getPlayer(), true);
			}
		},
		
		"click .fail": function(event) {
			if(!getPlayer().passed){
				event.target.style.backgroundColor = "green";
				Meteor.call("pass", getPlayer(), false);
			}
		},
		
		"click .end-game": function() {
			Meteor.call("endGame");
		}
	});
	
	/* Template - gameOver */
	
	Template.gameOver.helpers({
		innocentsWin: function() {
			return getGame().innocentsWin;
		}
	});
	
	Template.gameOver.events({
		"click .to-lobby": function() {
			Session.set("currentView", "lobby");
		}
	})
}

/* SERVER */

if (Meteor.isServer) {
  Meteor.startup(function () {
    Players.remove({});
		Game.remove({});
		Game.insert({
			missionNums: null,
			// semi-permanent
			state: "inLobby",
			// temporary
			gameState: null, 
			numPicked: 0,					
			numApprove: 0,				
			numReject: 0,				
			numPass: 0,						
			numFail: 0,					
			failedVotes: 0,      
			// incremental
			turn: null,
			round: 0,  						
			numRoundsPass: 0,			
			numRoundsFail: 0,			
			missionResults: [0,0,0,0,0]
		});
  });
}

/* METHODS */

Meteor.methods({
	createPlayer: function (text) {
		var player = {
			// permanent
			name: text,				// name of player
			innocent: true,	 	// player's allegiance
			// temporary
			turn: false,    	// whether it's this player's turn currently
			picked: false,		// whether this player is picked to go on a mission
			voted: false, 		// whether this player has voted yet
			approves: false, 	// whether this player approves of current mission
			passed: false,		// whether this player has pass/failed current mission yet
			passes: false,    // whether this player passes current mission
		}
		var playerID = Players.insert(player);
		return playerID;
	},
	
	resetUserState: function (playerID) {
		var player = Players.findOne(playerID);
		if(player){
			Players.remove(playerID);
		}
	},
	
	setupGame: function (numPlayers) {
		console.log("setupgame");
		var players = Players.find({});
		
		//assign traitor/innocent
		var numTraitors = Math.ceil(numPlayers/3);
		var np = numPlayers;
		var nt = numTraitors;
		players.forEach(function (player) {
			var num = Math.floor((Math.random() * np));
			if(num < nt) {
				Players.update(player._id, { $set: {innocent: false} });
				nt--;
			}
			np--;
		});
		//assign player with first turn
		var turn = Math.floor((Math.random() * numPlayers));
		var p1ID = players.fetch()[turn]._id;
		Players.update(p1ID, { $set: {turn: true} });
		//determine num players for each round
		switch(numPlayers) {
			case 5:
				var missionNums = [2,3,2,3,3];
				break;
			case 6:
				var missionNums = [2,3,4,3,4];
				break;
			case 7:
				var missionNums = [2,3,3,4,4];
				break;
			case 8:
				var missionNums = [3,4,4,5,5];
				break;
			case 9:
				var missionNums = [3,4,4,5,5];
				break;
			case 10:
				var missionNums = [3,4,4,5,5];
				break;
			default:
				console.log("BIG ERROR");
		}
		//update game state
		var game = Game.find().fetch()[0];
		Game.update(game._id, { $set: {
			// permanent
			missionNums: missionNums, // array of num players per mission
			// semi-permanent
			state: "inGame", 			// inLobby, inGame
			innocentsWin: null, 	// innocents win or not
			// temporary
			gameState: "picking", // picking, voting, passing
			numPicked: 0,					// current num players picked to go on mission
			numApprove: 0,				// num approving votes for current pick
			numReject: 0,					// num rejecting votes for current pick
			numPass: 0,						// num players who pass current mission
			numFail: 0,						// num players who fail current mission
			failedVotes: 0,       // num votes failed for current round
			// incremental
			turn: turn,  					// index of player whose turn it currently is
			round: 0,  						// round number 0-4
			numRoundsPass: 0,			// num successful missions
			numRoundsFail: 0,			// num failed missions
			missionResults: [0,0,0,0,0], // array of mission results
		}});
	},
	
	updatePicked: function(player) {
		var game = Game.find().fetch()[0];
		Players.update(player._id, { $set: {picked: !player.picked}});
		if(player.picked)
			inc = -1;
		else
			inc = 1;
		Game.update(game._id, { $inc: {numPicked: inc}});
	},
	
	submitPick: function() {
		var game = Game.find().fetch()[0];
		Game.update(game._id, { $set: {gameState: "voting"}});
		//reset vote values
		Game.update(game._id, { $set: {
			numApprove: 0, numReject: 0, numPass: 0, numFail: 0
		}});
		Players.find({}).forEach(function(player) {
			Players.update(player._id, { $set: {
				approves: false,
				passes: false,
			}});
		});
	},
	
	vote: function(player, approve) {
		var game = Game.find().fetch()[0];
		Players.update(player._id, { $set: {approves: approve, voted: true}});
		if(approve)
			Game.update(game._id, { $inc: {numApprove: 1}});
		else
			Game.update(game._id, { $inc: {numReject: 1}});
	},
	
	approveVote: function() {
		var game = Game.find().fetch()[0];
		Game.update(game._id, { $set: {gameState: "passing"}});
	},
	
	rejectVote: function() {
		console.log("rejectVote");
		var players = Players.find({});
		var numPlayers = players.count();
		var game = Game.find().fetch()[0];
		Players.update(players.fetch()[game.turn]._id, { $set: {turn: false}});
		var turn = (game.turn+1)%numPlayers;
		Players.update(players.fetch()[turn]._id, { $set: {turn: true}});
		Game.update(game._id, { 
			$set: {
				gameState: "picking",
				numPicked: 0,
				numApprove: 0,
				numReject: 0,
				numPass: 0,						
				numFail: 0,
				turn: turn,
			},
			$inc: {
				failedVotes: 1,
			}
		});
		Players.find({}).forEach(function(player) {
			Players.update(player._id, { $set: {
				picked: false,
				voted: false,
			}});
		});
	},
	
	pass: function(player, pass) {
		var game = Game.find().fetch()[0];
		Players.update(player._id, { $set: {passes: pass, passed: true}});
		if(pass)
			Game.update(game._id, { $inc: {numPass: 1}});
		else
			Game.update(game._id, { $inc: {numFail: 1}});
	},
	
	passMission: function(pass) {
		console.log("passMission");
		var game = Game.find().fetch()[0];
		if(pass){
			var missionResults = game.missionResults;
			missionResults[game.round] = 1;
			Game.update(game._id, { 
				$set: {missionResults: missionResults},
				$inc: {numRoundsPass: 1}
			});
		}
		else{
			Game.update(game._id, {
				$inc: {numRoundsFail: 1}
			});
		}
		var players = Players.find({});
		var numPlayers = players.count();
		Players.update(players.fetch()[game.turn]._id, { $set: {turn: false}});
		var turn = (game.turn+1)%numPlayers;
		Players.update(players.fetch()[turn]._id, { $set: {turn: true}});
		Game.update(game._id, {
			$set: {
				gameState: "picking",
				numPicked: 0,
				numApprove: 0,
				numReject: 0,
				turn: turn,
				failedVotes: 0
			},
			$inc: {round: 1}
		});
		Players.find({}).forEach(function(player) {
			Players.update(player._id, { $set: {
				picked: false,
				voted: false, 		
				approves: false, 	
				passed: false,	
			}});
		});
	},
	
	gameOver: function(win) {
		var game = Game.find().fetch()[0];
		Game.update(game._id, { $set: {
			missionNums: null,
			// semi-permanent
			state: "inLobby",
			// temporary
			gameState: null, 
			numPicked: 0,					
			numApprove: 0,				
			numReject: 0,				
			numPass: 0,						
			numFail: 0,					
			failedVotes: 0,      
			// incremental
			turn: null,
			round: 0,  						
			numRoundsPass: 0,			
			numRoundsFail: 0,			
			missionResults: [0,0,0,0,0],
			innocentsWin: win
		}});
		
		Players.find({}).forEach(function(player) {
			Players.update(player._id, { $set: {
				innocent: true,	 	
				turn: false,    
				picked: false,		
				voted: false, 	
				approves: false, 
				passed: false,	
				passes: false,
			}});
		});
	},
	
	endGame: function() {
		var game = Game.find().fetch()[0];
		Game.update(game._id, { $set: {numRoundsPass: 3}});
	}
})










