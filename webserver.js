/*
 *
 * A WebSocketServer
 * 
 */

var WebSocketServer = require('ws').Server;
var wss = new WebSocketServer({ port: 8080 });
console.log("Listening on port 8080");
var conns = [];

wss.on('connection', function (new_ws) {
    conns.push(new_ws);

    console.log('New client connected');
    new_ws.send('Connection established');

    // handle message from clients
    new_ws.on('message', function (message) {
        for(var i=0; i<conns.length; i++){
            if (conns[i]!= new_ws) conns[i].send(message);
        }
        console.log('received: %s', message);
    });

    new_ws.on('close', function(){
        new_ws.close();
        console.log('Client left');
        conns.splice(conns.indexOf(new_ws));
    });
});

