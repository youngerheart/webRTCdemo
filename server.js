
config = {
  'localhost': {
    backend: __dirname + '/api/',
    frondend: __dirname + '/web/',
    baseTemp: 'index.html'
  }
}
var server = require('web-node-server');
server.start(config);


var crypto=require('crypto');
var WS='258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

require('net').createServer(function(o){
  var key;
  o.on('data',function(e){
    if(!key){
      //获取发送过来的KEY
      key=e.toString().match(/Sec-WebSocket-Key: (.+)/)[1];
      //连接上WS这个字符串，并做一次sha1运算，最后转换成Base64
      key=crypto.createHash('sha1').update(key+WS).digest('base64');
      //输出返回给客户端的数据，这些字段都是必须的
      o.write('HTTP/1.1 101 Switching Protocols\r\n');
      o.write('Upgrade: websocket\r\n');
      o.write('Connection: Upgrade\r\n');
      //这个字段带上服务器处理后的KEY
      o.write('Sec-WebSocket-Accept: '+key+'\r\n');
      //输出空行，使HTTP头结束
      o.write('\r\n');
    }else{
      //数据处理
    };
  });
}).listen(8000);