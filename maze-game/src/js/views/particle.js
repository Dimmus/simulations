define(function(require) {

    'use strict';

    var PIXI = require('pixi');
    
    var PixiView  = require('common/pixi/view');
    var Vector2   = require('common/math/vector2');
    var Rectangle = require('common/math/rectangle');

    var Level = require('models/level');

    var Assets = require('assets');

    var Constants = require('constants');

    /**
     * A view that represents the player particle
     */
    var ParticleView = PixiView.extend({

        initialize: function(options) {
            this.mvt = options.mvt;

            this.initGraphics();

            this.listenTo(this.model, 'change:x', this.updateX);
            this.listenTo(this.model, 'change:y', this.updateY);
        },

        initGraphics: function() {
            this.sprite = Assets.createSprite(Assets.Images.PARTICLE);
            this.sprite.anchor.x = 0.5;
            this.sprite.anchor.y = 0.5;

            this.updateMVT(this.mvt);
        },

        updateX: function(particle, x) {
            this.sprite.x = this.mvt.modelToViewX(x);
        },

        updateY: function(particle, y) {
            this.sprite.y = this.mvt.modelToViewY(y);
        },

        updateMVT: function(mvt) {
            this.mvt = mvt;

            var tileSize = this.mvt.modelToViewDeltaX(Constants.TILE_SIZE);
            var tileScale = this.tileSize / Assets.Texture(Assets.Images.FLOOR).width;

            this.sprite.scale.x = tileScale;
            this.sprite.scale.y = tileScale;
        },

        update: function(time, deltaTime, paused) {
            if (this.model.get('colliding'))
                this.sprite.alpha = Math.random() * 0.4 + 0.3;
            else
                this.sprite.alpha = 1;
        }

    });

    return ParticleView;
});