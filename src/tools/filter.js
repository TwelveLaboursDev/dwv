import {ListenerHandler} from '../utils/listen';
import {
  Threshold as ThresholdFilter,
  Sobel as SobelFilter,
  Sharpen as SharpenFilter
} from '../image/filter';

/**
 * Filter tool.
 *
 * @class
 * @param {App} app The associated app.
 */
export class Filter {

  #app;

  constructor(app) {
    this.#app = app;
  }

  /**
   * Filter list
   *
   * @type {object}
   */
  #filterList = null;

  /**
   * Selected filter.
   *
   * @type {object}
   */
  #selectedFilter = 0;

  /**
   * Listener handler.
   *
   * @type {object}
   * @private
   */
  #listenerHandler = new ListenerHandler();

  /**
   * Activate the tool.
   *
   * @param {boolean} bool Flag to activate or not.
   */
  activate(bool) {
    // setup event listening
    for (var key in this.filterList) {
      if (bool) {
        this.filterList[key].addEventListener('filterrun', this.#fireEvent);
        this.filterList[key].addEventListener('filter-undo', this.#fireEvent);
      } else {
        this.filterList[key].removeEventListener(
          'filterrun', this.#fireEvent);
        this.filterList[key].removeEventListener(
          'filter-undo', this.#fireEvent);
      }
    }
  }

  /**
   * Set the tool options.
   *
   * @param {object} options The list of filter names amd classes.
   */
  setOptions(options) {
    this.#filterList = {};
    // try to instanciate filters from the options
    for (var key in options) {
      this.#filterList[key] = new options[key](this.#app);
    }
  }

  /**
   * Get the type of tool options: here 'instance' since the filter
   * list contains instances of each possible filter.
   *
   * @returns {string} The type.
   */
  getOptionsType() {
    return 'instance';
  }

  /**
   * Initialise the filter. Called once the image is loaded.
   */
  init() {
    // setup event listening
    for (var key in this.#filterList) {
      this.#filterList[key].init();
    }
  }

  /**
   * Handle keydown event.
   *
   * @param {object} event The keydown event.
   */
  keydown = (event) => {
    event.context = 'Filter';
    this.#app.onKeydown(event);
  };

  /**
   * Get the list of event names that this tool can fire.
   *
   * @returns {Array} The list of event names.
   */
  getEventNames() {
    return ['filterrun', 'filterundo'];
  }

  /**
   * Add an event listener to this class.
   *
   * @param {string} type The event type.
   * @param {object} callback The method associated with the provided
   *   event type, will be called with the fired event.
   */
  addEventListener(type, callback) {
    this.#listenerHandler.add(type, callback);
  }

  /**
   * Remove an event listener from this class.
   *
   * @param {string} type The event type.
   * @param {object} callback The method associated with the provided
   *   event type.
   */
  removeEventListener(type, callback) {
    this.#listenerHandler.remove(type, callback);
  }

  /**
   * Fire an event: call all associated listeners with the input event object.
   *
   * @param {object} event The event to fire.
   * @private
   */
  #fireEvent = (event) => {
    this.#listenerHandler.fireEvent(event);
  };

  /**
   * Get the selected filter.
   *
   * @returns {object} The selected filter.
   */
  getSelectedFilter() {
    return this.#selectedFilter;
  }

  /**
   * Set the tool live features: filter name.
   *
   * @param {object} features The list of features.
   */
  setFeatures(features) {
    if (typeof features.filterName !== 'undefined') {
      // check if we have it
      if (!this.hasFilter(features.filterName)) {
        throw new Error('Unknown filter: \'' + features.filterName + '\'');
      }
      // de-activate last selected
      if (this.#selectedFilter) {
        this.#selectedFilter.activate(false);
      }
      // enable new one
      this.#selectedFilter = this.filterList[features.filterName];
      // activate the selected filter
      this.#selectedFilter.activate(true);
    }
    if (typeof features.run !== 'undefined' && features.run) {
      var args = {};
      if (typeof features.runArgs !== 'undefined') {
        args = features.runArgs;
      }
      this.getSelectedFilter().run(args);
    }
  }

  /**
   * Get the list of filters.
   *
   * @returns {Array} The list of filter objects.
   */
  getFilterList() {
    return this.filterList;
  }

  /**
   * Check if a filter is in the filter list.
   *
   * @param {string} name The name to check.
   * @returns {string} The filter list element for the given name.
   */
  hasFilter(name) {
    return this.filterList[name];
  }

} // class Filter

/**
 * Threshold filter tool.
 *
 * @class
 * @param {App} app The associated application.
 */
export class Threshold {

  #app;

  constructor(app) {
    this.#app = app;
  }

  /**
   * Flag to know wether to reset the image or not.
   *
   * @type {boolean}
   * @private
   */
  #resetImage = true;

  /**
   * Listener handler.
   *
   * @type {object}
   * @private
   */
  #listenerHandler = new ListenerHandler();

  /**
   * Activate the filter.
   *
   * @param {boolean} bool Flag to activate or not.
   */
  activate(bool) {
    // reset the image when the tool is activated
    if (bool) {
      this.#resetImage = true;
    }
  }

  /**
   * Initialise the filter. Called once the image is loaded.
   */
  init() {
    // does nothing
  }

  /**
   * Run the filter.
   *
   * @param {*} args The filter arguments.
   */
  run(args) {
    var filter = new ThresholdFilter();
    filter.setMin(args.min);
    filter.setMax(args.max);
    // reset the image if asked
    if (this.#resetImage) {
      filter.setOriginalImage(this.#app.getLastImage());
      this.#resetImage = false;
    }
    var command = new RunFilterCommand(filter, this.#app);
    command.onExecute = this.#fireEvent;
    command.onUndo = this.#fireEvent;
    command.execute();
    // save command in undo stack
    this.#app.addToUndoStack(command);
  }

  /**
   * Add an event listener to this class.
   *
   * @param {string} type The event type.
   * @param {object} callback The method associated with the provided
   *  event type, will be called with the fired event.
   */
  addEventListener(type, callback) {
    this.#listenerHandler.add(type, callback);
  }

  /**
   * Remove an event listener from this class.
   *
   * @param {string} type The event type.
   * @param {object} callback The method associated with the provided
   *   event type.
   */
  removeEventListener(type, callback) {
    this.#listenerHandler.remove(type, callback);
  }

  /**
   * Fire an event: call all associated listeners with the input event object.
   *
   * @param {object} event The event to fire.
   * @private
   */
  #fireEvent = (event) => {
    this.#listenerHandler.fireEvent(event);
  };

} // class Threshold

/**
 * Sharpen filter tool.
 *
 * @class
 * @param {App} app The associated application.
 */
export class Sharpen {

  #app;

  constructor(app) {
    this.#app = app;
  }

  /**
   * Listener handler.
   *
   * @type {object}
   * @private
   */
  #listenerHandler = new ListenerHandler();

  /**
   * Activate the filter.
   *
   * @param {boolean} _bool Flag to activate or not.
   */
  activate(_bool) {
    // does nothing
  }

  /**
   * Initialise the filter. Called once the image is loaded.
   */
  init() {
    // does nothing
  }

  /**
   * Run the filter.
   *
   * @param {*} _args The filter arguments.
   */
  run(_args) {
    var filter = new SharpenFilter();
    filter.setOriginalImage(this.#app.getLastImage());
    var command = new RunFilterCommand(filter, this.#app);
    command.onExecute = this.#fireEvent;
    command.onUndo = this.#fireEvent;
    command.execute();
    // save command in undo stack
    this.#app.addToUndoStack(command);
  }

  /**
   * Add an event listener to this class.
   *
   * @param {string} type The event type.
   * @param {object} callback The method associated with the provided
   *    event type, will be called with the fired event.
   */
  addEventListener(type, callback) {
    this.#listenerHandler.add(type, callback);
  }

  /**
   * Remove an event listener from this class.
   *
   * @param {string} type The event type.
   * @param {object} callback The method associated with the provided
   *   event type.
   */
  removeEventListener(type, callback) {
    this.#listenerHandler.remove(type, callback);
  }

  /**
   * Fire an event: call all associated listeners with the input event object.
   *
   * @param {object} event The event to fire.
   * @private
   */
  #fireEvent = (event) => {
    this.#listenerHandler.fireEvent(event);
  };

} // filter.Sharpen

/**
 * Sobel filter tool.
 *
 * @class
 * @param {App} app The associated application.
 */
export class Sobel {

  #app;

  constructor(app) {
    this.#app = app;
  }

  /**
   * Listener handler.
   *
   * @type {object}
   * @private
   */
  #listenerHandler = new ListenerHandler();

  /**
   * Activate the filter.
   *
   * @param {boolean} _bool Flag to activate or not.
   */
  activate(_bool) {
    // does nothing
  }

  /**
   * Initialise the filter. Called once the image is loaded.
   */
  init() {
    // does nothing
  }

  /**
   * Run the filter.
   *
   * @param {*} _args The filter arguments.
   */
  run(_args) {
    var filter = new SobelFilter();
    filter.setOriginalImage(this.#app.getLastImage());
    var command = new RunFilterCommand(filter, this.#app);
    command.onExecute = this.#fireEvent;
    command.onUndo = this.#fireEvent;
    command.execute();
    // save command in undo stack
    this.#app.addToUndoStack(command);
  }

  /**
   * Add an event listener to this class.
   *
   * @param {string} type The event type.
   * @param {object} callback The method associated with the provided
   *  event type, will be called with the fired event.
   */
  addEventListener(type, callback) {
    this.#listenerHandler.add(type, callback);
  }

  /**
   * Remove an event listener from this class.
   *
   * @param {string} type The event type.
   * @param {object} callback The method associated with the provided
   *   event type.
   */
  removeEventListener(type, callback) {
    this.#listenerHandler.remove(type, callback);
  }

  /**
   * Fire an event: call all associated listeners with the input event object.
   *
   * @param {object} event The event to fire.
   * @private
   */
  #fireEvent = (event) => {
    this.#listenerHandler.fireEvent(event);
  };

} // class filter.Sobel

/**
 * Run filter command.
 *
 * @class
 * @param {object} filter The filter to run.
 * @param {App} app The associated application.
 */
export class RunFilterCommand {

  #filter;
  #app;

  constructor(filter, app) {
    this.#filter = filter;
    this.#app = app;
  }

  /**
   * Get the command name.
   *
   * @returns {string} The command name.
   */
  getName() {
    return 'Filter-' + this.#filter.getName();
  }

  /**
   * Execute the command.
   *
   * @fires RunFilterCommand#filterrun
   */
  execute() {
    // run filter and set app image
    this.#app.setLastImage(this.#filter.update());
    // update display
    this.#app.render(0); //todo: fix
    /**
     * Filter run event.
     *
     * @event RunFilterCommand#filterrun
     * @type {object}
     * @property {string} type The event type: filterrun.
     * @property {number} id The id of the run command.
     */
    var event = {
      type: 'filterrun',
      id: this.getName()
    };
    // callback
    this.onExecute(event);
  }

  /**
   * Undo the command.
   *
   * @fires RunFilterCommand#filterundo
   */
  undo() {
    // reset the image
    this.#app.setLastImage(this.#filter.getOriginalImage());
    // update display
    this.#app.render(0); //todo: fix
    /**
     * Filter undo event.
     *
     * @event RunFilterCommand#filterundo
     * @type {object}
     * @property {string} type The event type: filterundo.
     * @property {number} id The id of the undone run command.
     */
    var event = {
      type: 'filterundo',
      id: this.getName()
    }; // callback
    this.onUndo(event);
  }

  /**
   * Handle an execute event.
   *
   * @param {object} _event The execute event with type and id.
   */
  onExecute(_event) {
    // default does nothing.
  }

  /**
   * Handle an undo event.
   *
   * @param {object} _event The undo event with type and id.
   */
  onUndo(_event) {
    // default does nothing.
  }

} // RunFilterCommand class
