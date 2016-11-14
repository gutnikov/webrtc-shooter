// jscs:disable validateIndentation
ig.module(
  'game.entities.remote-player'
)
.requires(
  'impact.entity',
  'game.entities.particle'
)
.defines(function() {
  EntityRemotePlayer = ig.Entity.extend({

    type: ig.Entity.TYPE.B,

    size: {
      x: 8,
      y: 14
    },

    offset: {
      x: 4,
      y: 2
    },

    stateUpdated: false,

    animSheet: new ig.AnimationSheet('media/sprites/player-blue.png', 16, 16),

    init: function(x, y, settings) {
      this.parent(x, y, settings);
      this.addAnim('idle', 1, [0]);
      this.addAnim('scratch', 0.3, [2, 1, 2, 1, 2], true);
      this.addAnim('shrug', 0.3, [3, 3, 3, 3, 3, 3, 4, 3, 3], true);
      this.addAnim('run', 0.07, [6, 7, 8, 9, 10, 11]);
      this.addAnim('jump', 1, [15]);
      this.addAnim('fall', 0.4, [12, 13]);
      this.addAnim('land', 0.15, [14]);
      this.addAnim('die', 0.07, [18, 19, 20, 21, 22, 23, 16, 16, 16]);
      this.addAnim('spawn', 0.07, [16, 16, 16, 23, 22, 21, 20, 19, 18]);
    },
    setState: function(state) {
      var x = state.getX() / 10;
      var y = state.getY() / 10;
      this.dx = state.getVelX() / 10; //x - this.pos.x;
      this.dy = state.getVelY() / 10; //y - this.pos.y;
      this.pos = {
        x: x,
        y: y
      };
      this.currentAnim = this.getAnimById(state.getAnim());
      this.currentAnim.frame = state.getFrame();
      this.currentAnim.flip.x = !!state.getFlip();
      this.stateUpdated = true;
    },
    update: function() {
      if (this.stateUpdated) {
        this.stateUpdated = false;
      } else {
        this.pos.x += this.dx;
        this.pos.y += this.dy;
        if (this.currentAnim) {
          this.currentAnim.update();
        }
      }
    },
    kill: function() {
      this.parent();
    }
  });

});
