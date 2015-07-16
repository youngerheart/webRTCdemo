var webRTC = function() {
  //使用Google的stun服务器
  var iceServer = {
      'iceServers': [{
          'url': 'stun:stun.l.google.com:19302'
      }]
  };
  // NAT穿透信息对象
  var nativeRTCIceCandidate = (window.mozRTCIceCandidate || window.RTCIceCandidate);
  // session表述对象
  var nativeRTCSessionDescription = (window.RTCSessionDescription || window.mozRTCSessionDescription || window.RTCSessionDescription);
  
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

  var constraints = {
    mandatory: {
      OfferToReceiveAudio: true,
      OfferToReceiveVideo: true
    }
  };
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

  // 事件命名: 从服务器接受的事件加一个下划线，向服务器发送事件加两个下划线，前端事件不加下划线。

  // 必须的参数
  function webrtc() {
    // 本地的media流
    this.localMediaStream = null;
    // 所在的房间
    this.room = '';
    // 本地ws连接
    this.socket = null;
    //本地socket的id，由后台服务器创建
    this.me = null;
    // 保存所有与本地连接的peer connection，key为socketid，值为PeerConnection类型
    this.peerConnections = {};
    // 保存所有与本地连接的socket的id
    this.connections = [];
  }

  // 让其继承事件处理类
  webrtc.prototype = new EventEmitter();

  /*************连接服务器的部分*************/

  webrtc.prototype.connect = function(url, room) {
    var socket;
    var that = this;
    socket = this.socket = new WebSocket(url);
    socket.onopen = function() {
      // 发送进入房间的信息
      socket.send(JSON.stringify({
        event: '__join',
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
      that.localMediaStream.close();
      // 关掉每个peer
      for(var key in peerConnections) {
        that.closePeerConnection(peerConnections[key]);
      }
      that.peerConnections = {};
      that.connections = [];
    };

    // 服务器传回的所有连接的信息
    this.on('_peers', function(data) {
      that.connections = data.connections;
      that.me = data.you;
      that.emit('connected', socket);
    });

    // 收到某个连接的NAT穿透信息
    this.on('_ice_candidate', function(data) {
      var candidate = new nativeRTCIceCandidate(data);
      var pc = that.peerConnections[data.socketId];
      pc.addIceCandidate(candidate);
    });

    // 收到某个新连接
    this.on('_new_peer', function(data) {
      that.connections.push(data.socketId);
      var pc = that.createPeerConnection(data.socketId);
      pc.addStream(that.localMediaStream);
    });

    // 收到某个连接被关闭
    this.on('_remove_peer', function(data){
      that.closePeerConnection(that.peerConnections[data.socketId]);
      delete that.peerConnections[data.socketId];
      that.emit('remove_peer', data.socketId);
    });

    // 收到offer
    this.on('_offer', function(data) {
      that.receiveOffer(data.socketId, data.desc);
    });

    // 收到answer
    this.on('_answer', function(data) {
      that.receiveAnswer(data.socketId, data.desc);
    });

    // 在创建流媒体成功时触发ready
    this.on('ready', function() {
      that.createPeerConnections();
      that.addStreams();
      that.sendOffers();
    });
  };

  /*************本地流数据处理*************/

  // 创建本地流
  webrtc.prototype.createStream = function(options) {
    var that = this;
    if(getUserMedia) {
      getUserMedia.call(navigator, options, function(stream) {
        that.localMediaStream = stream;
        that.emit('stream_created', stream);
        that.emit('ready');
      }, function(error) {
        console.log(error);
      });
    } else {
      console.log('你的浏览器是有多老啊')
    }
  };

  // 将本地流添加到所有peer连接实例中
  webrtc.prototype.addStreams = function() {
    for(var key in this.peerConnections) {
      this.peerConnections[key].addStream(this.localMediaStream);
    }
  };

  // 将某个流绑定到某个video标签输出
  webrtc.prototype.attachStream = function(stream, el) {
    el.src = URL.createObjectURL(stream);
    el.play();
  };

  /*************信令交换(offer & answer)*************/

  // 向所有连接发送offer
  webrtc.prototype.sendOffers = function() {

    var pc = null;
    var that = this;
    var success = function(pc, socketId) {
      return function(desc) {
        pc.setLocalDescription(new nativeRTCSessionDescription(desc), function() {
          that.socket.send(JSON.stringify({
            'event': '__offer',
            'data': {
              'desc': desc,
              'socketId': socketId,
              'me': that.me
            }
          }));
        }, function(err) {
          console.log(err);
        });
      }
    };

    for(var i = 0; i < this.connections.length; i ++) {
      pc = this.peerConnections[this.connections[i]];
      pc.createOffer(success(pc, this.connections[i]), function(err) {
        console.log(err);
      }, constraints);
    }
  };

  // 接受到offer后的操作
  webrtc.prototype.receiveOffer = function(socketId, desc) {
    this.sendAnswer(socketId, desc);
  };

  // 发送answer
  webrtc.prototype.sendAnswer = function(socketId, desc) {
    var pc = this.peerConnections[socketId];
    var that = this;
    pc.setRemoteDescription(new nativeRTCSessionDescription(desc), function() {
      pc.createAnswer(function(desc) {
        pc.setLocalDescription(desc, function() {
          that.socket.send(JSON.stringify({
            'event': '__answer',
            'data': {
              'socketId': socketId,
              'desc': desc,
              'me': that.me
            }
          }));
        }, function(err) {
          console.log(err);
        });
      }, function(err) {
        console.log(err);
      }, constraints);
    },function(err) {
      console.log(err);
    });
  };

  // 收到answer之后将对方的session表述写入连接
  webrtc.prototype.receiveAnswer = function(socketId, desc) {
    var pc = this.peerConnections[socketId];
    pc.setRemoteDescription(new nativeRTCSessionDescription(desc));
  };

  /*************端到端连接操作(PeerConnections)*************/


  // 创建与其他用户的连接
  webrtc.prototype.createPeerConnections = function() {
    for(var i = 0; i < this.connections.length; i ++) {
      this.createPeerConnection(this.connections[i]);
    }
  };

  // 创建单个连接
  webrtc.prototype.createPeerConnection = function(socketId) {
    var that = this;
    var pc = new PeerConnection(iceServer);
    this.peerConnections[socketId] = pc;

    pc.onicecandidate = function(e) {
      if(e.candidate) {
        that.socket.send(JSON.stringify({
          'event': '__ice_candidate',
          'data': {
            'label': e.candidate.sdpMLineIndex,
            'candidate': e.candidate.candidate,
            'socketId': socketId,
            'me': that.me
          }
        }));
      }
    }

    pc.onaddstream = function(e) {
      that.emit('pc_add_stream', e.stream, socketId, pc);
    };

    return pc;
  };

  //关闭PeerConnection连接
  webrtc.prototype.closePeerConnection = function(pc) {
    if (!pc) return;
    pc.close();
  };

  // 返回实例化对象
  return new webrtc();
};


