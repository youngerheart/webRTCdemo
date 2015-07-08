var $el = function(id) {
  return document.getElementById(id);
}

var $newel = function(tagName) {
  return document.createElement(tagName);
}

var videos = $el('videos');
var sendBtn = $el('sendBtn');
var msgs = $el('msgs');
var sendFileBtn = $el('sendFileBtn');
var files = $el('files');
var me = $el('me');
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

// 创建本地视频流成功
rtc.on('stream_created', function(stream) {
  me.src = URL.createObjectURL(stream);
  me.play();
});

// 创建本地视频流失败
rtc.on('stream_created_error', function() {
  alert('stream_created_error');
});

// 接收到其他用户的视频流
rtc.on('pc_add_stream', function(stream, socketId) {
  var newVideo = $newel('video');
  newVideo.className = 'other';
  newVideo.setAttribute('autoplay', 'autoplay');
  newVideo.id = 'other' + socketId;
  videos.appendChild(newVideo);
  rtc.attachStream(stream, id);
});

// 删除其他用户
rtc.on('remove_peer', function(socketId) {
  var video = $el('other-' + socketId);
  if(video) video.parentNode.removeChild(vedio);
});

rtc.connect('ws://' + location.hostname + ':8000', location.hash.slice(1));
