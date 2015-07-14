var webRTC = function() {
  //使用Google的stun服务器
  var iceServer = {
      'iceServers': [{
          'url': 'stun:stun.l.google.com:19302'
      }]
  };

  var nativeRTCSessionDescription = (window.mozRTCSessionDescription || window.RTCSessionDescription);
  
  //兼容浏览器的getUserMedia写法
  var getUserMedia = (navigator.getUserMedia ||
                      navigator.webkitGetUserMedia || 
                      navigator.mozGetUserMedia || 
                      navigator.msGetUserMedia);

  //兼容浏览器的PeerConnection写法
  var PeerConnection = (window.PeerConnection ||
                      window.webkitPeerConnection || 
                      window.webkitRTCPeerConnection || 
                      window.mozRTCPeerConnection);


  // 一个处理事件的类
  function EventEmitter() {
    this.events = {};
  }
  // 绑定事件
  EventEmitter.prototype.on = function(eventName, callback) {
    this.events[eventName] = callback;
  }
  // 触发事件
  EventEmitter.prototype.emit = function(eventName) {
    if(!this.events[eventName]) return;
    this.events[eventName].apply(null, Array.prototype.slice.call(arguments, 1));
  }

  // 必须的参数
  function webrtc() {
    // 本地的media流
    this.localMediaStream = null;
    // 所在的房间
    this.room = '';
    // 本地ws连接
    this.socket = null;
    // 保存所有与本地连接的peer connection，key为socketid，值为PeerConnection类型
    this.peerConnections = {};
    // 保存所有与本地连接的socket的id
    this.connections = [];
  }

  // 让其继承事件处理类
  webrtc.prototype = new EventEmitter();

  // 连接服务器的部分
  webrtc.prototype.connect = function(url, room) {
    var socket;
    var that = this;
    socket = this.socket = new WebSocket(url);
    socket.onopen = function() {
      // 发送进入房间的信息
      socket.send(JSON.stringify({
        event: 'join',
        data: {
          room: room
        }
      }));
    };

    socket.onmessage = function(msg) {
      var json = JSON.parse(msg.data);
      // 触发事件
      if(json.eventName) {
        that.emit(json.eventName, json.data);
      }
    };
};

