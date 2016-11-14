// jscs:disable validateIndentation
ig.module(
  'game.main'
)
.requires(
  'impact.game',
  'impact.font',

  'game.camera',
  'game.entities.player',
  'game.entities.remote-player',
  'game.levels.main',
  'game.levels.main1',
  'game.events',

  'net.room-connection'
)
.defines(function() {

var log = console.log.bind(console);

// Messages
var MESSAGE_STATE = 0;
var MESSAGE_DIED = 2;
var MESSAGE_SHOOT = 3;
var MESSAGE_COLLECT_WEAPON = 4;
var MESSAGE_FRAG_COUNT = 5;

// Fields
var FIELD_TYPE = 'type';
var FIELD_X = 'x';
var FIELD_Y = 'y';
var FIELD_VEL_X = 'vel_x';
var FIELD_VEL_Y = 'vel_y';
var FIELD_ANIM = 'anim';
var FIELD_FRAME = 'frame';
var FIELD_FLIP = 'flip';
var FIELD_WEAPON_ID = 'weapon_id';
var FIELD_KILLER_ID = 'killer_id';
var FIELD_FRAG_COUNT = 'frag_count';

MyGame = ig.Game.extend({

  WEAPON_RESPAWN_TIME: 10, //sec
  WEAPON_PER_TUBE: 2,

  SHOW_MESSAGE_PERIOD: 1.3,

  // Load a font
  font: new ig.Font('media/04b03.font.png'),

  gravity: 240,

  roomName: window.location.search,

  fragCount: 0,

  connection: null,

  player: null,
  remotePlayers: {},

  spawnWeaponQueue: [],

  textMessage: 'FIGHT!!!',
  textMessageTimer: 0,

  init: function() {
    this.connection = gameRoom.roomConnection;
    this.connectionHandlers = {
      'peer_message': this.onPeerMessage,
      'user_leave': this.onUserLeave
    };
    Events.on(this.connection, this.connectionHandlers, this);

    // input
    ig.input.bind(ig.KEY.LEFT_ARROW, 'left');
    ig.input.bind(ig.KEY.RIGHT_ARROW, 'right');
    ig.input.bind(ig.KEY.X, 'jump');
    ig.input.bind(ig.KEY.C, 'shoot');
    this.loadLevel(LevelMai);

    // player
    this.spawnPlayer();

    // camera
    this.camera = new Camera(ig.system.width / 4,ig.system.height / 3,5);
    this.camera.trap.size.x = ig.system.width / 10;
    this.camera.trap.size.y = ig.system.height / 3;
    this.camera.lookAhead.x = ig.ua.mobile ? ig.system.width / 6 : 0;
    this.camera.max.x = this.collisionMap.width * this.collisionMap.tilesize - ig.system.width;
    this.camera.max.y = this.collisionMap.height * this.collisionMap.tilesize - ig.system.height;
    this.camera.set(this.player);
  },

  playerShoot: function() {
    var isFlip = this.player.flip;
    var x = this.player.pos.x + (isFlip ? -3 : 5);
    var y = this.player.pos.y + 6;

    // Spawn an entity, and broadcast about it
    ig.game.spawnEntity(EntityProjectile, x, y, {
      flip: isFlip
    });
    this.connection.broadcastMessage(MessageBuilder.createMessage(MESSAGE_SHOOT)
      .setX(x)
      .setY(y)
      .setFlip(isFlip)
    );
  },

  playerDied: function(killerId) {
    var msg = MessageBuilder.createMessage(MESSAGE_DIED);
    if (killerId) {
      msg.setKillerId(killerId);
    }
    this.connection.broadcastMessage(msg);
    this.spawnPlayer();
  },

  spawnPlayer: function() {
    var spawnPos = this.getRandomSpawnPos();
    this.player = this.spawnEntity(EntityPlayer, spawnPos.x, spawnPos.y);
  },

  getRandomSpawnPos: function() {
    var pods = ig.game.getEntitiesByType(EntityRespawnPod);
    var pod = pods[0/*Number.random(0, pods.length - 1)*/];
    return pod.getSpawnPos();
  },

  onUserLeave: function(user) {
    var remotePlayer = this.remotePlayers[user.userId];
    if (remotePlayer) {
      remotePlayer.kill();
      delete this.remotePlayers[user.userId];
    }
  },

  onPeerMessage: function(message, user, peer) {
    var remotePlayer = this.remotePlayers[user.userId];
    if (!remotePlayer && message.getType() === MESSAGE_STATE) {
      log('%cCreated remote player for %d', 'color: blue;', user.userId);
      remotePlayer = this.spawnRemotePlayer(user, message.getX(), message.getY());
    }
    switch (message.getType()) {
      case MESSAGE_STATE:
        this.onPlayerState(remotePlayer, message);
        break;

      case MESSAGE_DIED:
        this.onPlayerDied(remotePlayer, message, user);
        break;

      case MESSAGE_SHOOT:
        this.onPlayerShoot(remotePlayer, message, user);
        break;

      case MESSAGE_COLLECT_WEAPON:
        this.onRemotePlayerCollectedWeapon(remotePlayer, message);
        break;

      case MESSAGE_FRAG_COUNT:
        this.onRemotePlayerFragCount(remotePlayer, message, user);
        break;
    }
  },

  spawnRemotePlayer: function(user, x, y) {
    this.remotePlayers[user.userId] =
      this.spawnEntity(EntityRemotePlayer, x, y);
    return this.remotePlayers[user.userId];
  },

  onPlayerState: function(remotePlayer, message) {
    remotePlayer.setState(message);
  },

  onPlayerDied: function(remotePlayer, message, user) {
    if (message.getKillerId() === this.connection.roomInfo.userId) {
      this.fragCount++;
      this.connection.broadcastMessage(MessageBuilder.createMessage(MESSAGE_FRAG_COUNT)
        .setFragCount(this.fragCount)
      );
      this.setTextMessage('Yeahh! ' + this.fragCount + ' frags!');
    }
    if (remotePlayer) {
      remotePlayer.kill();
    }
    delete this.remotePlayers[user.userId];
  },

  onPlayerShoot: function(remotePlayer, message, user) {
    ig.game.spawnEntity(EntityProjectileRemote, message.getX(), message.getY(), {
      flip: message.getFlip(),
      userId: user.userId
    });
  },

  onRemotePlayerCollectedWeapon: function(remotePlayer, message) {
    this.onWeaponCollected(message.getWeaponId());
  },

  onRemotePlayerFragCount: function(remotePlayer, message, user) {
    this.setTextMessage('Player ' + user.userId + ' has ' + message.getFragCount() + ' frags!!');
  },

  onPlayerCollectedWeapon: function(weapon) {
    this.player.addWeapons(this.WEAPON_PER_TUBE);
    this.connection.broadcastMessage(MessageBuilder.createMessage(MESSAGE_COLLECT_WEAPON)
      .setWeaponId(weapon.weaponId)
    );
    this.onWeaponCollected(weapon.weaponId);
  },

  onWeaponCollected: function(weaponId) {
    var weapon = ig.game.getEntitiesByType(EntityTestTube).find(function(weapon) {
      return weapon.weaponId === weaponId;
    });
    if (weapon) {
      weapon.kill();
      this.spawnWeaponQueue.push([weapon, ig.Timer.time]);
    }
  },

  spawnWeapons: function() {
    while (this.spawnWeaponQueue.length) {
      var delta = ig.Timer.time - this.spawnWeaponQueue[0][1];
      if (delta < this.WEAPON_RESPAWN_TIME) {
        break;
      }
      var weapon = this.spawnWeaponQueue.pop()[0];
      ig.game.spawnEntity(EntityTestTube, weapon.pos.x, weapon.pos.y, {
        weaponId: weapon.weaponId
      });
    }
  },

  update: function() {
    this.camera.follow(this.player);
    // Update all entities and backgroundMaps
    this.parent();

    // Broadcast state
    this.connection.broadcastMessage(MessageBuilder.createMessage(MESSAGE_STATE)
      .setX(this.player.pos.x * 10)
      .setY(this.player.pos.y * 10)
      .setVelX((this.player.pos.x - this.player.last.x) * 10)
      .setVelY((this.player.pos.y - this.player.last.y) * 10)
      .setFrame(this.player.getAnimFrame())
      .setAnim(this.player.getAnimId())
      .setFlip(this.player.currentAnim.flip.x ? 1 : 0));

    this.updateText();
    this.spawnWeapons();
  },

  draw: function() {
    // Draw all entities and backgroundMaps
    this.parent();
    this.camera.draw();
    this.drawText();
  },

  setTextMessage: function(message) {
    this.textMessage = message;
    this.textMessageTimer = ig.Timer.time;
  },

  drawText: function() {
    if (this.textMessage) {
      this.font.draw(this.textMessage, ig.system.width / 2, 8, ig.Font.ALIGN.CENTER);
    }
  },

  updateText: function() {
    if (!this.textMessage) {
      return;
    }
    if (ig.Timer.time - this.textMessageTimer >= this.SHOW_MESSAGE_PERIOD) {
      this.textMessage = '';
    }
  }
});

GameRoom = ig.Class.extend({
  roomId: null,
  roomConnection: null,
  socket: null,

  init: function(socketUrl) {
    this.roomId = window.location.search.slice(1);
    this.registerMessages();
    this.socket = io(socketUrl);
    this.roomConnection = new RoomConnection(this.roomId, this.socket);
    this.roomConnection.on('joined', this.onJoinedRoom, this);
    this.roomConnection.connect();
  },

  registerMessages: function() {
    MessageBuilder.registerMessageType(MESSAGE_STATE, [
      FIELD_TYPE,
      FIELD_X,
      FIELD_Y,
      FIELD_VEL_X,
      FIELD_VEL_Y,
      FIELD_FRAME,
      FIELD_ANIM,
      FIELD_FLIP
    ]);
    MessageBuilder.registerMessageType(MESSAGE_DIED, [
      FIELD_TYPE,
      FIELD_KILLER_ID
    ]);
    MessageBuilder.registerMessageType(MESSAGE_SHOOT, [
      FIELD_TYPE,
      FIELD_X,
      FIELD_Y,
      FIELD_FLIP
    ]);
    MessageBuilder.registerMessageType(MESSAGE_COLLECT_WEAPON, [
      FIELD_TYPE,
      FIELD_WEAPON_ID
    ]);
    MessageBuilder.registerMessageType(MESSAGE_FRAG_COUNT, [
      FIELD_TYPE,
      FIELD_FRAG_COUNT
    ]);
  },

  onJoinedRoom: function(roomInfo) {
    console.log('%cJoined room', 'color: green', roomInfo);
    ig.main('#canvas', MyGame, 60, 240, 160, 3);
  }
});
var gameRoom = new GameRoom('http://' + window.location.hostname + ':8033');

});
