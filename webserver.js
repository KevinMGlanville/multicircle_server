/*
 * @author: Kevin Glanville
 * Websocket server manages multicircle games
 * 
 */

var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({ port: 8080 });
console.log("Listening on port 8080");
var unallocated = [];
var waiting_randoms = [];
var waiting_named = new Object();
var in_match = [];

// On connect, set up comms; wait for game name message before queueing the player
wss.on('connection', function (new_ws) {

    // connection origin - incorrectly shows host, not remote connect
    //var origin_index = new_ws['upgradeReq']['rawHeaders'].indexOf('Origin');
    //var conn_key = new_ws._socket;
    console.log('New connection from: ' + new_ws._socket.server._connectionKey);

    var message_object = new Object();
    message_object['message'] = "waiting";
    new_ws.send(JSON.stringify(message_object), function(error){});

    // send player to unallocated until they send a message about where they want to go
    unallocated.unshift(new_ws);
    console.log('Unallocated connection. Total unallocated: ' + unallocated.length);

    // send players to the correct list of players
    // unallocated TO waiting_randoms OR waiting_named
    // if player is not already in one of those lists
    new_ws.on('message', function(message){
        var message_object = new Object();

        try{
            message_object = JSON.parse(message);
        }
        catch(Exception){

        }

        // send unallocated to waiting_randoms or waiting_named
        // if waiting_named doesn't have the game, send the player to waiting_named, else match 'em up
        if(message_object['message'] == 'join'){

            if(waiting_named[new_ws['game']] == new_ws){
                var message_object = new Object();
                message_object['message'] = "disconnect";
                new_ws.send(JSON.stringify(message_object), function(error){});
                new_ws.close();
            }

            if (!waiting_named[message_object['game']]) {
                new_ws['game'] = message_object['game'];
                waiting_named[message_object['game']] = new_ws;
                unallocated.splice(unallocated.indexOf(new_ws));

                new_ws.on('close', function () {
                    // remove player from waiting list
                    if (waiting_named[message_object['game']] == new_ws) {
                        delete waiting_named[message_object['game']];
                        new_ws.close();
                        var count = 0;
                        for(var prop in waiting_named) count++;
                        console.log("Named matches - waiting player left. Named match players waiting: " + count);
                    }
                });
            }
            else {
                var player1 = waiting_named[message_object['game']];
                var player2 = new_ws;

                // remove players from waiting
                unallocated.splice(unallocated.indexOf(new_ws));
                unallocated.splice(unallocated.indexOf(message_object['game']));
                delete waiting_named[message_object['game']];
                match_players(player1, player2);
            }
        }
    });

    new_ws.on('close', function () {
        if(unallocated.indexOf(new_ws) > -1){
            unallocated.splice(unallocated.indexOf(new_ws));
            new_ws.close();
            console.log("Unallocated player left. Unallocated players: " + unallocated.length);
        }
    });
});


// match 2 players and let them know they're playing
function match_players(player1, player2){
    var players = [];
    players.unshift(player1);
    players.unshift(player2);
    player1['opponent'] = player2;
    player2['opponent'] = player1;

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

    // log players matched
    console.log('Players matched. Unallocated players: ' + unallocated.length);
    console.log('Players matched. Randoms waiting: ' + waiting_randoms.length);
    console.log('Players matched. Players in matches: ' + in_match.length);

    // notify players of their number
    var message_object = new Object();
    message_object['message'] = "player1";
    player1.send(JSON.stringify(message_object), function(error){});
    message_object['message'] = "player2";
    player2.send(JSON.stringify(message_object), function(error){});
}
