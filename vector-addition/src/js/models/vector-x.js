define(function(require) {

  var DraggableArrowView = require('common/pixi/view/arrow-draggable');

  var VectorXViewModel = DraggableArrowView.ArrowViewModel.extend({
    defaults: {
      originX: 0,
      originY: 0,
      targetX: 0,
      targetY: 0
    },

    initialize: function() {

    }

  });

  return VectorXViewModel;

});
