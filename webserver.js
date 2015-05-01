/**
 * Websocket server manages multicircle games
 *
 * @author: Kevin Glanville
 */

// require the einaros websocket library and start listening
var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({ port: 8080 });
console.log("Listening on port 8080");

// new connections which aren't waiting for a game
var unallocated = [];
// connections which have provided a game name to join
var waiting_named = new Object();
// connections which have been matched
var in_match = [];

// On connect, set up comms; wait for game name message before queueing the player
wss.on('connection', function (new_ws) {

    // connection origin
    console.log('New connection from: ' + new_ws.upgradeReq.connection.remoteAddress);

    // object containing information to/from the clients
    var message_object = new Object();
    message_object['message'] = "waiting";
    new_ws.send(JSON.stringify(message_object), function(error){});

    // send player to unallocated until they send a message about where they want to go
    unallocated.unshift(new_ws);
    console.log('Unallocated connection. Total unallocated: ' + unallocated.length);

    // handle messages from connections
    new_ws.on('message', function(message){
        var message_object = new Object();

        try{
            message_object = JSON.parse(message);
        }
        catch(Exception){

        }

        // if the game isn't in waiting_named, put the connection there until another connection requests the game
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
                        // counting is slightly messy because javascript doesn't support associative arrays
                        var count = 0;
                        for(var prop in waiting_named) count++;
                        console.log("Named matches - waiting player left. Named match players waiting: " + count);
                    }
                });
            }
            // match players if game exists
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

    // if the connection was still in unallocated on connection close, remove the connection
    // connections closed in other states will have different actions
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
    // players in the game
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
    console.log('Players matched. Players in matches: ' + in_match.length);

    // notify players of their number
    var message_object = new Object();
    message_object['message'] = "player1";
    player1.send(JSON.stringify(message_object), function(error){});
    message_object['message'] = "player2";
    player2.send(JSON.stringify(message_object), function(error){});
}
