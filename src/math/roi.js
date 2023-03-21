/**
 * Region Of Interest shape.
 * Note: should be a closed path.
 *
 * @class
 */
export class ROI {

  /**
   * List of points.
   *
   * @private
   * @type {Array}
   */
  #points = [];

  /**
   * Get a point of the list at a given index.
   *
   * @param {number} index The index of the point to get
   *   (beware, no size check).
   * @returns {Point2D} The Point2D at the given index.
   */
  getPoint(index) {
    return this.#points[index];
  }

  /**
   * Get the length of the point list.
   *
   * @returns {number} The length of the point list.
   */
  getLength() {
    return this.#points.length;
  }

  /**
   * Add a point to the ROI.
   *
   * @param {Point2D} point The Point2D to add.
   */
  addPoint(point) {
    this.#points.push(point);
  }

  /**
   * Add points to the ROI.
   *
   * @param {Array} rhs The array of POints2D to add.
   */
  addPoints(rhs) {
    this.#points = this.#points.concat(rhs);
  }

} // ROI class
