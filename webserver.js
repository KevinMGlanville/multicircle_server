/*
 *
 * Websocket server manages multicircle games
 * 
 */

var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({ port: 8080 });
console.log("Listening on port 8080");
var waiting = [];
var in_match = [];

wss.on('connection', function (new_ws) {

    var origin_index = new_ws['upgradeReq']['rawHeaders'].indexOf('Origin');
    console.log('New connection from: ' + new_ws['upgradeReq']['rawHeaders'][origin_index+1]);
    var message_object = new Object();
    message_object['message'] = "waiting";
    new_ws.send(JSON.stringify(message_object), function(error){});

    // match up waiting opponents
    waiting.unshift(new_ws);
    console.log('New client connected. Players waiting: ' + waiting.length);

    // matchup players until there is only one in waiting
    while(waiting.length > 1){

        // assign opponents (add to players[] for convenience)
        var player1 = waiting[waiting.length-1];
        var player2 = waiting[waiting.length-2];
        var players = [];
        players.unshift(player1);
        players.unshift(player2);
        player1['opponent'] = player2;
        player2['opponent'] = player1;

        // remove players from waiting
        waiting.splice(waiting.indexOf(waiting.length-1));
        waiting.splice(waiting.indexOf(waiting.length-2));

        // add event handlers for each player
        players.forEach(function(player){
            // add players to matched array
            in_match.unshift(player);

            // notify players of match
            var message_object = new Object();
            message_object['message'] = "matched";
            player.send(JSON.stringify(message_object), function(error){});

            // handle messages from players
            player.on('message', function(message){
                player['opponent'].send(message, function(error){});
                console.log('Received from player in match: %s', message);
            });

            // handle player leaving
            player.on('close', function(){
                player.close();
                message_object['message'] = 'opponent exit';
                player['opponent'].send(JSON.stringify(message_object), function(error){});
                player['opponent'].close();
                console.log('In-match player left');
                in_match.splice(in_match.indexOf(player));
                console.log('Player left. Players in match: ' + in_match.length);
            });
        });
        console.log('Players matched. Players waiting: ' + waiting.length + '. Players in-match ' + in_match.length);
        var message_object = new Object();
        message_object['message'] = "player1";
        player1.send(JSON.stringify(message_object), function(error){});
        message_object['message'] = "player2";
        player2.send(JSON.stringify(message_object), function(error){});
    }

    new_ws.on('close', function () {
        if(waiting.indexOf(new_ws) > -1){
            waiting.splice(waiting.indexOf(new_ws));
            new_ws.close();
            console.log("Waiting player left. Players waiting: " + waiting.length);
        }
    });
});

