
config = {
  'localhost': {
    backend: __dirname + '/api/',
    frondend: __dirname + '/web/',
    baseTemp: 'index.html'
  }
}
var server = require('web-node-server');
server.start(config);

var sockets = {};
var rooms = {};

var addSocket = function(socket) {
  sockets[socket.id] = socket;
};

var getSocket = function(id) {
  return sockets[i];
}

var ws = require('node-websocket').init;
ws.on('connection', function(socket) {

  ws.on('__join', function(data) {
    console.log('__join ');
    conns = [];
    addSocket(socket);
    for(var key in sockets) {
      if (key === socket.id) {
        continue;
      }
      conns.push(key);
      sockets[key].send(JSON.stringify({
        'eventName': '_new_peer',
        'data': {
          'socketId': socket.id
        }
      }));
    }
    socket.send(JSON.stringify({
      'eventName': '_peers',
      'data': {
        'connections': conns,
        'you': socket.id
      }
    }));
  });

  ws.on('__ice_candidate', function(data) {
    console.log('__ice_candidate');
    var soc = getSocket(data.socketId);
    if(soc) {
      soc.send(JSON.stringify({
        'eventName': '_ice_candidate',
        'data': {
          'label': data.label,
          'candidate': data.candidate,
          'socketId': data.me
        }
      }));
    }
  });

  ws.on('__offer', function(data){
    console.log('__offer');
    var soc = getSocket(data.socketId);
    if(soc) {
      soc.send(JSON.stringify({
        'eventName': '_offer',
        'data': {
          'desc': data.desc,
          'socketId': data.me
        }
      }));
    }
  });

  ws.on('__answer', function(data){
    console.log('__answer');
    var soc = getSocket(data.socketId);
    if(soc) {
      soc.send(JSON.stringify({
        'eventName': "_answer",
        'data': {
          'desc': data.desc,
          'socketId': data.me
        }
      }));
    }
  });
});

ws.on('close', function(socketId) {
 console.log('close ' + socketId);
 delete sockets[socketId];
});

ws.start(8000);