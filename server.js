
config = {
  'localhost': {
    backend: __dirname + '/api/',
    frondend: __dirname + '/web/',
    baseTemp: 'index.html'
  }
}
var server = require('web-node-server');
server.start(config);

// 储存所有的socket对象，key为socketId
var sockets = {};
// 这个东西之后再实现吧，房间功能 = =
var rooms = {};

var addSocket = function(socket) {
  sockets[socket.id] = socket;
};

var getSocket = function(id) {
  return sockets[id];
}

// 自己做的websocket功能封装
var ws = require('node-websocket').init;
ws.on('connection', function(socket) {
  // join的时候保存socket对象，向远端发送new_peer事件，向本端发送peers事件
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
        eventName: '_new_peer',
        data: {
          socketId: socket.id
        }
      }));
    }
    socket.send(JSON.stringify({
      eventName: '_peers',
      data: {
        connections: conns,
        you: socket.id
      }
    }));
  });

  // 穿透NAT后，向远端发送穿透信息
  ws.on('__ice_candidate', function(data) {
    console.log('__ice_candidate');
    var soc = getSocket(data.socketId);
    if(soc) {
      soc.send(JSON.stringify({
        eventName: '_ice_candidate',
        data: {
          label: data.label,
          candidate: data.candidate,
          socketId: data.me
        }
      }));
    }
  });

  // 向远端发送offer信息
  ws.on('__offer', function(data){
    console.log('__offer');
    var soc = getSocket(data.socketId);
    if(soc) {
      soc.send(JSON.stringify({
        eventName: '_offer',
        data: {
          desc: data.desc,
          socketId: data.me
        }
      }));
    }
  });

  // 回传给本端的answer信息
  ws.on('__answer', function(data){
    console.log('__answer');
    var soc = getSocket(data.socketId);
    if(soc) {
      soc.send(JSON.stringify({
        eventName: "_answer",
        data: {
          desc: data.desc,
          socketId: data.me
        }
      }));
    }
  });
});

// 某个连接断开了，删除这个连接的socket对象，同时告诉其他人
ws.on('close', function(socketId) {
  console.log('close ' + socketId);
  delete sockets[socketId];
  for(var key in sockets) {
   sockets[key].send(JSON.stringify({
    eventName: '_remove_peer',
    data: {
      'socketId': socketId
    }
  }));
  }
});

ws.start(8000);