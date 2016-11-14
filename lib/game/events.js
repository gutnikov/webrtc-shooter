// jscs:disable validateIndentation
ig.module(
  'game.events'
)
.defines(function() {

// Event emitter + utils to subscribe/unsubscribe events in different ways:
// addEventListener/removeEventListener for RTCPeerConnection etc
// on/off for socket.io sockets
EventEmitter = ig.Class.extend({
  lastToken: 0,
  subscribers: null,

  init: function() {
    this.subscribers = {};
  },

  destroy: function() {
    this.subscribers = null;
  },

  emit: function(event) {
    var emitArgs = [].slice.call(arguments, 1);
    for (var k in this.subscribers) {
      scb = this.subscribers[k];
      if (scb.event === event) {
        scb.subscriber.apply(scb.ctx, emitArgs);
      }
    }
  },

  on: function(event, subscriber, ctx) {
    var token = ++this.lastToken;
    this.subscribers[token] = {
      event: event,
      subscriber: subscriber,
      ctx: ctx
    };
    return token;
  },

  off: function(token) {
    delete this.subscribers[token];
  }
});

Events = {

  Emitter: EventEmitter,

  listen: function() {
    this._listen('addEventListener', arguments);
  },

  unlisten: function() {
    this._unlisten('removeEventListener', arguments);
  },

  on: function() {
    this._listen('on', arguments);
  },

  off: function() {
    this._unlisten('off', arguments);
  },

  _listen: function(method, argsObject) {
    var args = [].slice.apply(argsObject);
    var object = args[0];
    var handlers = args[1];
    var context = args[2];
    var bindArgs = args.slice(2);
    for (var k in handlers) {
      var bound = context[k + '_bound'] = handlers[k].bind.apply(handlers[k], bindArgs);
      object[method](k, bound);
    }
  },

  _unlisten: function(method, args) {
    var object = args[0];
    var handlers = args[1];
    var context = args[2];
    for (var k in handlers) {
      object[method](k, context[k + '_bound']);
    }
  }
};

});
