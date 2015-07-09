
config = {
  'localhost': {
    backend: __dirname + '/api/',
    frondend: __dirname + '/web/',
    baseTemp: 'index.html'
  }
}
var server = require('web-node-server');
server.start(config);

var ws = require('./websocket').init();
ws.on('join', function(data, socketId) {
  console.log(data, socketId);
});
ws.start(8000);