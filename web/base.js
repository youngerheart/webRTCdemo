var $el = function(id) {
  return document.getElementById(id);
}

var videos = $el('videos');
var sendBtn = $el('sendBtn');
var msgs = $el('msgs');
var sendFileBtn = $el('sendFileBtn');
var files = $el('files');
var rtc = webRTC();

sendBtn.onclick = function(event) {
  var msg = $el('msgInput');
  p.innerText = 'me:' + msg.value;
  // 广播消息
  rtc.broadcast(msg);
  msg.appendChild(p);
};

rtc.on('send_file_accpted', function(sendId, socketId, file) {
  var p = $el('file-' + sendId);
  p.innerText = '对方接受' + file.name + '文件，等待发送';
});

// 创建好WebSocket连接
rtc.on('connected', function() {
  // 创建本地视频流
  rtc.createStream({
    'video': true,
    'audio': true
  });
});


