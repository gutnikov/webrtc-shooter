// jscs:disable validateIndentation
ig.module(
  'net.peer-connection'
)
.requires(
  'game.events'
)
.defines(function() {

PeerConnection = Events.Emitter.extend({

  CHANNEL_NAME: 'data',

  iceServers: [{
    url: 'stun:stun.l.google.com:19302'
  },{
    url: 'stun:stun.anyfirewall.com:3478'
  },{
    url: 'turn:turn.bistri.com:80',
    credential: 'homeo',
    username: 'homeo'
  },{
    url: 'turn:turn.anyfirewall.com:443?transport=tcp',
    credential: 'webrtc',
    username: 'webrtc'
  }],

  socket: null,
  isInitiator: false,
  dataChannelReady: false,
  peerConnection: null,
  dataChannel: null,
  remoteDescriptionReady: false,
  pendingCandidates: null,
  lastMessageOrd: null,

  init: function(socket, peerUser, isInitiator) {
    this.parent();
    this.socket = socket;
    this.peerUser = peerUser;
    this.isInitiator = isInitiator;
    this.pendingCandidates = [];
    this.peerHandlers = {
      'icecandidate': this.onLocalIceCandidate,
      'iceconnectionstatechange': this.onIceConnectionStateChanged,
      'datachannel': this.onDataChannel
    };
    this.dataChannelHandlers = {
      'open': this.onDataChannelOpen,
      'close': this.onDataChannelClose,
      'message': this.onDataChannelMessage
    };
    this.connect();
  },

  destroy: function() {
    this.parent();
    this.closePeerConnection();
  },

  connect: function() {
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers
    });
    Events.listen(this.peerConnection, this.peerHandlers, this);
    if (this.isInitiator) {
      this.openDataChannel(
          this.peerConnection.createDataChannel(this.CHANNEL_NAME, {
        ordered: false
      }));
    }
    if (this.isInitiator) {
      this.setLocalDescriptionAndSend();
    }
  },

  closePeerConnection: function() {
    this.closeDataChannel();
    Events.unlisten(this.peerConnection, this.peerHandlers, this);
    if (this.peerConnection.signalingState !== 'closed') {
      this.peerConnection.close();
    }
  },

  setSdp: function(sdp) {
    var self = this;
    // Create session description from sdp data
    var rsd = new RTCSessionDescription(sdp);
    // And set it as remote description for peer connection
    self.peerConnection.setRemoteDescription(rsd)
      .then(function() {
        self.remoteDescriptionReady = true;
        self.log('Got SDP from remote peer', 'green');
        // Add all received remote candidates
        while (self.pendingCandidates.length) {
          self.addRemoteCandidate(self.pendingCandidates.pop());
        }
        // Got offer? send answer
        if (!self.isInitiator) {
          self.setLocalDescriptionAndSend();
        }
      });
  },

  setLocalDescriptionAndSend: function() {
    var self = this;
    self.getDescription()
      .then(function(localDescription) {
        self.peerConnection.setLocalDescription(localDescription)
          .then(function() {
            self.log('Sending SDP', 'green');
            self.sendSdp(self.peerUser.userId, localDescription);
          });
      })
      .catch(function(error) {
        self.log('onSdpError: ' + error.message, 'red');
      });
  },

  getDescription: function() {
    return this.isInitiator ?
      this.peerConnection.createOffer() :
      this.peerConnection.createAnswer();
  },

  addIceCandidate: function(candidate) {
    if (this.remoteDescriptionReady) {
      this.addRemoteCandidate(candidate);
    } else {
      this.pendingCandidates.push(candidate);
    }
  },

  addRemoteCandidate: function(candidate) {
    try {
      this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      this.log('Added his ICE-candidate:' + candidate.candidate, 'gray');
    } catch (err) {
      this.log('Error adding remote ice candidate' + err.message, 'red');
    }
  },

  // When ice framework discoveres new ice candidate, we should send it
  // to opponent, so he knows how to reach us
  onLocalIceCandidate: function(event) {
    if (event.candidate) {
      this.log('Send my ICE-candidate: ' + event.candidate.candidate, 'gray');
      this.sendIceCandidate(this.peerUser.userId, event.candidate);
    } else {
      this.log('No more candidates', 'gray');
    }
  },

  // Connectivity has changed? For example someone turned off wifi
  onIceConnectionStateChanged: function(event) {
    this.log('Connection state: ' + event.target.iceConnectionState, 'green');
  },

  onDataChannel: function(event) {
    if (!this.isInitiator) {
      this.openDataChannel(event.channel);
    }
  },

  openDataChannel: function(channel) {
    this.dataChannel = channel;
    Events.listen(this.dataChannel, this.dataChannelHandlers, this);
  },

  closeDataChannel: function() {
    Events.unlisten(this.dataChannel, this.dataChannelHandlers, this);
    this.dataChannel.close();
  },

  // Data channel
  sendMessage: function(message) {
    if (!this.dataChannelReady) {
      return;
    }
    this.dataChannel.send(message);
  },

  onDataChannelOpen: function() {
    this.dataChannelReady = true;
    this.emit('open');
  },

  onDataChannelMessage: function(event) {
    this.emit('message', MessageBuilder.deserialize(event.data));
  },

  onDataChannelClose: function() {
    this.dataChannelReady = false;
    this.emit('closed');
  },

  sendSdp: function(userId, sdp) {
    this.socket.emit('sdp', {
      userId: userId,
      sdp: sdp
    });
  },

  sendIceCandidate: function(userId, candidate) {
    this.socket.emit('ice_candidate', {
      userId: userId,
      candidate: candidate
    });
  },

  log: function(message, color) {
    console.log('%c[Peer-%d, %s] %s', 'color:' + color, this.peerUser.userId,
      this.peerConnection.signalingState, message);
  }
});

});
