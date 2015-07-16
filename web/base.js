var $el = function(name) {
  return document.getElementById(name);
};

// 装video标签的容器
var videos = $el('videos');
// webRTC封装类
var rtc = webRTC();

// 创建好自己的websocket对象时
rtc.on('connected', function() {
  rtc.createStream({
    'video': true,
    'audio': true
  });
});

// 创建本地流数据成功
rtc.on('stream_created', function(stream) {
  $el('me').src = URL.createObjectURL(stream);
  $el('me').play();
});

// 收到远端的流数据
rtc.on('pc_add_stream', function(stream, socketId) {
  console.log('pc_add_stream!!');
  var newVideo = document.createElement('video'),
      id = 'other-' + socketId;
  newVideo.setAttribute('class', 'other');
  newVideo.setAttribute('autoplay', 'autoplay');
  newVideo.setAttribute('id', id);
  videos.appendChild(newVideo);
  rtc.attachStream(stream, newVideo);
});

//删除其他用户
rtc.on('remove_peer', function(socketId) {
  var video = document.getElementById('other-' + socketId);
  if(video){
    video.parentNode.removeChild(video);
  }
});

//连接服务器！
rtc.connect('ws:' + location.hostname + ':8000', window.location.hash.slice(1));