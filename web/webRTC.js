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
    // 接受的暂存的文件
    this.fileData = {};
    // 保存所有接收到的文件
    this.receiveFiles = {};
    // 本地ws连接
    this.socket = null;
    // 本地socketid,由服务器端创建
    this.me = null;
    // 保存所有与本地连接的peer connection，key为socketid，值为PeerConnection类型
    this.peerConnections = {};
    // 保存所有与本地连接的socket的id
    this.connections = [];
    // 初始时(进入房间)需要构建的链接数目
    this.needStreams = 0;
    // 初始时已近连接的数目
    this.initializedStreams = 0;
    // 保存所有的data channel,key为socketid，值为PeerConnection示例的createChannel创建
    this.dataChannels = {};
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

    socket.onclose = function(data) {
      // 关掉本地视频流
      that.localMediaStream.close();
      // 关掉已经连接的客户端
      var pc = that.peerConnections;
      for(i = 0; i < pc.length;i ++) {
        that.closePeerConnection(pc[i]);
      }
      that.peerConnections = {};
      that.dataChannels = {};
      that.connections = [];
      that.fileData = [];
    };
  }

  // 流处理

  // 创建本地流
  webrtc.prototype.createStream = function(options) {
    var that = this;
    if(getUserMedia) {
      this.needStreams ++;
      getUserMedia.call(navigator, options, function(stream) {
        that.localMediaStream = stream;
        that.initializedStreams++;
        that.emit('stream_created', stream);
        if (that.initializedStreams === that.needStreams) {
          that.emit('ready');
        }
      },
      function(error) {
          that.emit('stream_create_error', error);
      });
    } else {
      that.emit('stream_create_error', new Error('WebRTC is not yet supported in this browser.'));
    }
  };

  // 将流绑定到video标签用于输出
  webrtc.prototype.bindStream = function(stream, el) {
    if (navigator.mozGetUserMedia) {
      el.mozSrcObject = stream;
      el.play();
    } else {
      el.src = webkitURL.createObjectURL(stream);
    }
    el.src = webkitURL.createObjectURL(stream);
  };

  // 指令发送

  // 向所有的peerConnection发送Offer指令
  webrtc.prototype.sendOffers = function() {
    var that = this;
    var pc = null;
    var create = function(pc, socketId) {
      return function(desc) {
      pc.setLocalDescription(sessionDesc);
        that.socket.send(JSON.stringify({
            eventName: 'offer',
            'data': {
                sdp: desc,
                socketId: socketId
            }
        }));
      };
    };
    var error = function(err) {
      console.log(err)
    };

    for(var i = 0; i < this.connections.length; i ++) {
      pc = this.peerConnections[this.connections[i]];
      pc.createOffer(create(pc, this.connections[i]), error);
    }
  };

  // 接收到Offer类型信令后作为回应返回answer类型信令
  webrtc.prototype.receiveOffer = function(socketId, sessionDesc) {
    this.sendAnswer(socketId, sessionDesc);
  };

  // 发送answer类型信令
  webrtc.prototype.sendAnswer = function(socketId, sessionDesc) {
    var that = this;
    var pc = this.peerConnections[socketId];
    pc.setRemoteDescription(new nativeRTCSessionDescription(sessionDesc));
    pc.createAnswer(function(desc) {
      pc.setLocalDescription(desc);
      that.socket.send(JSON.stringify({
        eventName: 'answer',
        data: {
          socketId: socketId,
          sessionDesc: desc
        }
      }));
    }, function(err) {
      console.log(error);
    });
  };

  // 收到answer类型之后将对方的session描述写入PeerConnction中
  webrtc.prototype.receiveAnswer = function(socketId, sessionDesc) {
    var pc = this.peerConnections[socketId];
    pc.setRemoteDescription(new nativeRTCSessionDescription(sessionDesc));
  };

  // 点对点视频连接

  // 创建与其他用户连接的PeerConnction
  webrtc.prototype.createPeerConnections = function() {
    var i, m;
    for (i = 0, m = this.connections.length; i < m; i++) {
        this.createPeerConnection(this.connections[i]);
    }
  };

  // 创建单个PeerConnection
  webrtc.prototype.createPeerConnection = function(socketId) {
    var that = this;
    var pc = new PeerConnection(iceServer);
    this.peerConnections[socketId] = pc;
    pc.onicecandidate = function(event) {
      if(event.candidate) {
        that.socket.send(JSON.stringify({
          eventName: 'ice_candidate',
          data: {
            label: event.candidate.sdpMLineIndex,
            candidate: event.candidate.candidate,
            socketId: socketId
          }
        }));
      }
    };
  };

  // 关闭PeerConnection连接
  webrtc.prototype.closePeerConnection = function(pc) {
    if(!pc) return;
    pc.close();
  };

  // 数据通道连接部分

  // 消息广播
  webrtc.prototype.broadcast = function(msg) {
    var socketId = null;
    for(socketId in this.dataChannels) {
      this.sendMessage(msg, socketId);
    }
  };

  // 发送消息方法
  webrtc.prototype.sendMessage = function(msg, socketId) {
    if(this.dataChannels[socketId].readyState.toLowerCase() === 'open') {
      this.dataChannels[socketId].send(JSON.stringify({
        type: 'msg',
        data: message
      }));
    }
  };

  // 对所有的PeerConnection创建DataChannel
  webrtc.prototype.addDataChannels = function() {
    var connection = null;
    for (connection in this.peerConnections) {
      this.createDataChannel(connection);
    }
  };

  // 对某一个PeerConnection创建Data channel
  webrtc.prototype.createDataChannel = function(socketId, label) {
    var pc = this.peerConnections[socketId];
    if(!socketId) {
      this.emit('data_channel_create_error', socketId, new Error('Failed to create date channel without socket id'));
    }
    try {
      channel = pc.createDataChannel(label);
    } catch (err) {
      this.emit('data_channel_create_error', socketId, err);
    }
    return this.addDataChannel(socketId, channel);
  };

  // 返回一个函数
  webrtc.prototype.addDataChannel = function(socketId, channel) {
    var that = this;
    channel.onopen = function() {
      that.emit('data_channel_opened', channel, socketId);
    };

    channel.onclose = function() {
      delete that.addDataChannels[socketId];
      that.emit('data_channel_closed', channel, socketId);
    };

    channel.onmessage = function(msg) {
      var json = JSON.parse(msg.data);
      if(json.type === 'file') {
      } else {
        that.emit('data_channel_message', channel,socketId, err);
      }
    };

    channel.onerror = function(err) {
      that.emit('data_channel_error', channel, socketId, err);
    }
    this.dataChannels[socketId] = channel;
    return channel;
  };

  return new webrtc();
};

