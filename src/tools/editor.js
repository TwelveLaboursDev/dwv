import {getLayerDetailsFromEvent} from '../gui/layerGroup';
import {logger} from '../utils/logger';
import {getShapeDisplayName, ChangeGroupCommand} from './drawCommands';
import {validateAnchorPosition} from './draw';
// external
import Konva from 'konva';

/**
 * Get the default anchor shape.
 *
 * @param {number} x The X position.
 * @param {number} y The Y position.
 * @param {string} id The shape id.
 * @param {object} style The application style.
 * @returns {object} The default anchor shape.
 */
export function getDefaultAnchor(x, y, id, style) {
  var radius = style.applyZoomScale(3);
  return new Konva.Ellipse({
    x: x,
    y: y,
    stroke: '#999',
    fill: 'rgba(100,100,100,0.7',
    strokeWidth: style.getStrokeWidth(),
    strokeScaleEnabled: false,
    radius: {
      x: Math.abs(radius.x),
      y: Math.abs(radius.y)
    },
    name: 'anchor',
    id: id,
    dragOnTop: false,
    draggable: true,
    visible: false
  });
}

/**
 * Shape editor.
 *
 * @param {object} app The associated application.
 * @class
 */
export class ShapeEditor {

  #app;

  constructor(app) {
    this.#app = app;
  }

  /**
   * Shape factory list
   *
   * @type {object}
   * @private
   */
  #shapeFactoryList = null;

  /**
   * Current shape factory.
   *
   * @type {object}
   * @private
   */
  #currentFactory = null;

  /**
   * Edited shape.
   *
   * @private
   * @type {object}
   */
  #shape = null;

  /**
   * Edited view controller. Used for quantification update.
   *
   * @private
   * @type {object}
   */
  #viewController = null;

  /**
   * Active flag.
   *
   * @private
   * @type {boolean}
   */
  #isActive = false;

  /**
   * Draw event callback.
   *
   * @private
   * @type {Function}
   */
  #drawEventCallback = null;

  /**
   * Set the tool options.
   *
   * @param {Array} list The list of shape classes.
   */
  setFactoryList(list) {
    this.#shapeFactoryList = list;
  }

  /**
   * Set the shape to edit.
   *
   * @param {object} inshape The shape to edit.
   */
  setShape(inshape) {
    this.#shape = inshape;
    if (this.#shape) {
      // remove old anchors
      this.#removeAnchors();
      // find a factory for the input shape
      var group = this.#shape.getParent();
      var keys = Object.keys(this.#shapeFactoryList);
      this.#currentFactory = null;
      for (var i = 0; i < keys.length; ++i) {
        var factory = new this.#shapeFactoryList[keys[i]];
        if (factory.isFactoryGroup(group)) {
          this.#currentFactory = factory;
          // stop at first find
          break;
        }
      }
      if (this.#currentFactory === null) {
        throw new Error('Could not find a factory to update shape.');
      }
      // add new anchors
      this.#addAnchors();
    }
  }

  /**
   * Set the associated image.
   *
   * @param {object} vc The associated view controller.
   */
  setViewController(vc) {
    this.#viewController = vc;
  }

  /**
   * Get the edited shape.
   *
   * @returns {object} The edited shape.
   */
  getShape() {
    return this.#shape;
  }

  /**
   * Get the active flag.
   *
   * @returns {boolean} The active flag.
   */
  isActive() {
    return this.#isActive;
  }

  /**
   * Set the draw event callback.
   *
   * @param {object} callback The callback.
   */
  setDrawEventCallback(callback) {
    this.#drawEventCallback = callback;
  }

  /**
   * Enable the editor. Redraws the layer.
   */
  enable() {
    this.#isActive = true;
    if (this.#shape) {
      this.#setAnchorsVisible(true);
      if (this.#shape.getLayer()) {
        this.#shape.getLayer().draw();
      }
    }
  }

  /**
   * Disable the editor. Redraws the layer.
   */
  disable() {
    this.#isActive = false;
    if (this.#shape) {
      this.#setAnchorsVisible(false);
      if (this.#shape.getLayer()) {
        this.#shape.getLayer().draw();
      }
    }
  }

  /**
   * Reset the anchors.
   */
  resetAnchors() {
    // remove previous controls
    this.#removeAnchors();
    // add anchors
    this.#addAnchors();
    // set them visible
    this.#setAnchorsVisible(true);
  }

  /**
   * Apply a function on all anchors.
   *
   * @param {object} func A f(shape) function.
   * @private
   */
  #applyFuncToAnchors(func) {
    if (this.#shape && this.#shape.getParent()) {
      var anchors = this.#shape.getParent().find('.anchor');
      anchors.forEach(func);
    }
  }

  /**
   * Set anchors visibility.
   *
   * @param {boolean} flag The visible flag.
   * @private
   */
  #setAnchorsVisible(flag) {
    this.#applyFuncToAnchors(function (anchor) {
      anchor.visible(flag);
    });
  }

  /**
   * Set anchors active.
   *
   * @param {boolean} flag The active (on/off) flag.
   */
  setAnchorsActive(flag) {
    var func = null;
    if (flag) {
      func = function (anchor) {
        this.#setAnchorOn(anchor);
      };
    } else {
      func = function (anchor) {
        this.#setAnchorOff(anchor);
      };
    }
    this.#applyFuncToAnchors(func);
  }

  /**
   * Remove anchors.
   *
   * @private
   */
  #removeAnchors() {
    this.#applyFuncToAnchors(function (anchor) {
      anchor.remove();
    });
  }

  /**
   * Add the shape anchors.
   *
   * @private
   */
  #addAnchors() {
    // exit if no shape or no layer
    if (!this.#shape || !this.#shape.getLayer()) {
      return;
    }
    // get shape group
    var group = this.#shape.getParent();

    // activate and add anchors to group
    var anchors =
      this.#currentFactory.getAnchors(this.#shape, this.#app.getStyle());
    for (var i = 0; i < anchors.length; ++i) {
      // set anchor on
      this.#setAnchorOn(anchors[i]);
      // add the anchor to the group
      group.add(anchors[i]);
    }
  }

  /**
   * Get a simple clone of the input anchor.
   *
   * @param {object} anchor The anchor to clone.
   * @returns {object} A clone of the input anchor.
   * @private
   */
  #getClone(anchor) {
    // create closure to properties
    var parent = anchor.getParent();
    var id = anchor.id();
    var x = anchor.x();
    var y = anchor.y();
    // create clone object
    var clone = {};
    clone.getParent = function () {
      return parent;
    };
    clone.id = function () {
      return id;
    };
    clone.x = function () {
      return x;
    };
    clone.y = function () {
      return y;
    };
    return clone;
  }

  /**
   * Set the anchor on listeners.
   *
   * @param {object} anchor The anchor to set on.
   * @private
   */
  #setAnchorOn(anchor) {
    var startAnchor = null;

    // command name based on shape type
    var shapeDisplayName = getShapeDisplayName(this.#shape);

    // drag start listener
    anchor.on('dragstart.edit', (evt) => {
      startAnchor = this.#getClone(this);
      // prevent bubbling upwards
      evt.cancelBubble = true;
    });
    // drag move listener
    anchor.on('dragmove.edit', (evt) => {
      var layerDetails = getLayerDetailsFromEvent(evt.evt);
      var layerGroup = this.#app.getLayerGroupByDivId(layerDetails.groupDivId);
      var drawLayer = layerGroup.getActiveDrawLayer();
      // validate the anchor position
      validateAnchorPosition(drawLayer.getBaseSize(), this);
      // update shape
      this.#currentFactory.update(
        this, this.#app.getStyle(), this.#viewController);
      // redraw
      if (this.getLayer()) {
        this.getLayer().draw();
      } else {
        logger.warn('No layer to draw the anchor!');
      }
      // prevent bubbling upwards
      evt.cancelBubble = true;
    });
    // drag end listener
    anchor.on('dragend.edit', (evt) => {
      var endAnchor = this.#getClone(this);
      // store the change command
      var chgcmd = new ChangeGroupCommand(
        shapeDisplayName,
        this.#currentFactory.update,
        startAnchor,
        endAnchor,
        this.getLayer(),
        this.#viewController,
        this.#app.getStyle()
      );
      chgcmd.onExecute = this.#drawEventCallback;
      chgcmd.onUndo = this.#drawEventCallback;
      chgcmd.execute();
      this.#app.addToUndoStack(chgcmd);
      // reset start anchor
      startAnchor = endAnchor;
      // prevent bubbling upwards
      evt.cancelBubble = true;
    });
    // mouse down listener
    anchor.on('mousedown touchstart', () => {
      this.moveToTop();
    });
    // mouse over styling
    anchor.on('mouseover.edit', () => {
      // style is handled by the group
      this.stroke('#ddd');
      if (this.getLayer()) {
        this.getLayer().draw();
      } else {
        logger.warn('No layer to draw the anchor!');
      }
    });
    // mouse out styling
    anchor.on('mouseout.edit', () => {
      // style is handled by the group
      this.stroke('#999');
      if (this.getLayer()) {
        this.getLayer().draw();
      } else {
        logger.warn('No layer to draw the anchor!');
      }
    });
  }

  /**
   * Set the anchor off listeners.
   *
   * @param {object} anchor The anchor to set off.
   * @private
   */
  #setAnchorOff(anchor) {
    anchor.off('dragstart.edit');
    anchor.off('dragmove.edit');
    anchor.off('dragend.edit');
    anchor.off('mousedown touchstart');
    anchor.off('mouseover.edit');
    anchor.off('mouseout.edit');
  }

} // class Editor
