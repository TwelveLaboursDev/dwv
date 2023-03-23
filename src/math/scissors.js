import {BucketQueue} from './bucketQueue';

// Pre-created to reduce allocation in inner loops
const __twothirdpi = (2 / (3 * Math.PI));

/**
 * @param {Array} data The input data.
 * @param {number} width The width of the output.
 * @param {number} height The height of the output.
 * @returns {Array} A greyscale object
 */
function computeGreyscale(data, width, height) {
  // Returns 2D augmented array containing greyscale data
  // Greyscale values found by averaging colour channels
  // Input should be in a flat RGBA array, with values between 0 and 255
  var greyscale = [];

  // Compute actual values
  for (var y = 0; y < height; y++) {
    greyscale[y] = [];

    for (var x = 0; x < width; x++) {
      var p = (y * width + x) * 4;
      greyscale[y][x] = (data[p] + data[p + 1] + data[p + 2]) / (3 * 255);
    }
  }

  // Augment with convenience functions
  greyscale.dx = function (x, y) {
    if (x + 1 === this[y].length) {
      // If we're at the end, back up one
      x--;
    }
    return this[y][x + 1] - this[y][x];
  };

  greyscale.dy = function (x, y) {
    if (y + 1 === this.length) {
      // If we're at the end, back up one
      y--;
    }
    return this[y][x] - this[y + 1][x];
  };

  greyscale.gradMagnitude = function (x, y) {
    var dx = this.dx(x, y);
    var dy = this.dy(x, y);
    return Math.sqrt(dx * dx + dy * dy);
  };

  greyscale.laplace = function (x, y) {
    // Laplacian of Gaussian
    var lap = -16 * this[y][x];
    lap += this[y - 2][x];
    lap += this[y - 1][x - 1] + 2 * this[y - 1][x] + this[y - 1][x + 1];
    lap += this[y][x - 2] +
      2 * this[y][x - 1] + 2 * this[y][x + 1] + this[y][x + 2];
    lap += this[y + 1][x - 1] + 2 * this[y + 1][x] + this[y + 1][x + 1];
    lap += this[y + 2][x];

    return lap;
  };

  return greyscale;
}

/**
 * @param {object} greyscale The input greyscale-
 * @returns {object} A gradient object
 */
function computeGradient(greyscale) {
  // Returns a 2D array of gradient magnitude values for greyscale. The values
  // are scaled between 0 and 1, and then flipped, so that it works as a cost
  // function.
  var gradient = [];

  var max = 0; // Maximum gradient found, for scaling purposes

  var x = 0;
  var y = 0;

  for (y = 0; y < greyscale.length - 1; y++) {
    gradient[y] = [];

    for (x = 0; x < greyscale[y].length - 1; x++) {
      gradient[y][x] = greyscale.gradMagnitude(x, y);
      max = Math.max(gradient[y][x], max);
    }

    gradient[y][greyscale[y].length - 1] = gradient[y][greyscale.length - 2];
  }

  gradient[greyscale.length - 1] = [];
  for (var i = 0; i < gradient[0].length; i++) {
    gradient[greyscale.length - 1][i] = gradient[greyscale.length - 2][i];
  }

  // Flip and scale.
  for (y = 0; y < gradient.length; y++) {
    for (x = 0; x < gradient[y].length; x++) {
      gradient[y][x] = 1 - (gradient[y][x] / max);
    }
  }

  return gradient;
}

/**
 * @param {object} greyscale The input greyscale.
 * @returns {object} A laplace object.
 */
function computeLaplace(greyscale) {
  // Returns a 2D array of Laplacian of Gaussian values
  var laplace = [];

  // Make the edges low cost here.

  laplace[0] = [];
  laplace[1] = [];
  for (var i = 1; i < greyscale.length; i++) {
    // Pad top, since we can't compute Laplacian
    laplace[0][i] = 1;
    laplace[1][i] = 1;
  }

  for (var y = 2; y < greyscale.length - 2; y++) {
    laplace[y] = [];
    // Pad left, ditto
    laplace[y][0] = 1;
    laplace[y][1] = 1;

    for (var x = 2; x < greyscale[y].length - 2; x++) {
      // Threshold needed to get rid of clutter.
      laplace[y][x] = (greyscale.laplace(x, y) > 0.33) ? 0 : 1;
    }

    // Pad right, ditto
    laplace[y][greyscale[y].length - 2] = 1;
    laplace[y][greyscale[y].length - 1] = 1;
  }

  laplace[greyscale.length - 2] = [];
  laplace[greyscale.length - 1] = [];
  for (var j = 1; j < greyscale.length; j++) {
    // Pad bottom, ditto
    laplace[greyscale.length - 2][j] = 1;
    laplace[greyscale.length - 1][j] = 1;
  }

  return laplace;
}

function computeGradX(greyscale) {
  // Returns 2D array of x-gradient values for greyscale
  var gradX = [];

  for (var y = 0; y < greyscale.length; y++) {
    gradX[y] = [];

    for (var x = 0; x < greyscale[y].length - 1; x++) {
      gradX[y][x] = greyscale.dx(x, y);
    }

    gradX[y][greyscale[y].length - 1] = gradX[y][greyscale[y].length - 2];
  }

  return gradX;
}

function computeGradY(greyscale) {
  // Returns 2D array of y-gradient values for greyscale
  var gradY = [];

  for (var y = 0; y < greyscale.length - 1; y++) {
    gradY[y] = [];

    for (var x = 0; x < greyscale[y].length; x++) {
      gradY[y][x] = greyscale.dy(x, y);
    }
  }

  gradY[greyscale.length - 1] = [];
  for (var i = 0; i < greyscale[0].length; i++) {
    gradY[greyscale.length - 1][i] = gradY[greyscale.length - 2][i];
  }

  return gradY;
}

function gradUnitVector(gradX, gradY, px, py, out) {
  // Returns the gradient vector at (px,py), scaled to a magnitude of 1
  var ox = gradX[py][px];
  var oy = gradY[py][px];

  var gvm = Math.sqrt(ox * ox + oy * oy);
  gvm = Math.max(gvm, 1e-100); // To avoid possible divide-by-0 errors

  out.x = ox / gvm;
  out.y = oy / gvm;
}

function gradDirection(gradX, gradY, px, py, qx, qy) {
  var __dgpuv = {x: -1, y: -1};
  var __gdquv = {x: -1, y: -1};
  // Compute the gradiant direction, in radians, between to points
  gradUnitVector(gradX, gradY, px, py, __dgpuv);
  gradUnitVector(gradX, gradY, qx, qy, __gdquv);

  var dp = __dgpuv.y * (qx - px) - __dgpuv.x * (qy - py);
  var dq = __gdquv.y * (qx - px) - __gdquv.x * (qy - py);

  // Make sure dp is positive, to keep things consistant
  if (dp < 0) {
    dp = -dp;
    dq = -dq;
  }

  if (px !== qx && py !== qy) {
    // We're going diagonally between pixels
    dp *= Math.SQRT1_2;
    dq *= Math.SQRT1_2;
  }

  return __twothirdpi * (Math.acos(dp) + Math.acos(dq));
}

function computeSides(dist, gradX, gradY, greyscale) {
  // Returns 2 2D arrays, containing inside and outside greyscale values.
  // These greyscale values are the intensity just a little bit along the
  // gradient vector, in either direction, from the supplied point. These
  // values are used when using active-learning Intelligent Scissors

  var sides = {};
  sides.inside = [];
  sides.outside = [];

  var guv = {x: -1, y: -1}; // Current gradient unit vector

  for (var y = 0; y < gradX.length; y++) {
    sides.inside[y] = [];
    sides.outside[y] = [];

    for (var x = 0; x < gradX[y].length; x++) {
      gradUnitVector(gradX, gradY, x, y, guv);

      //(x, y) rotated 90 = (y, -x)

      var ix = Math.round(x + dist * guv.y);
      var iy = Math.round(y - dist * guv.x);
      var ox = Math.round(x - dist * guv.y);
      var oy = Math.round(y + dist * guv.x);

      ix = Math.max(Math.min(ix, gradX[y].length - 1), 0);
      ox = Math.max(Math.min(ox, gradX[y].length - 1), 0);
      iy = Math.max(Math.min(iy, gradX.length - 1), 0);
      oy = Math.max(Math.min(oy, gradX.length - 1), 0);

      sides.inside[y][x] = greyscale[iy][ix];
      sides.outside[y][x] = greyscale[oy][ox];
    }
  }

  return sides;
}

function gaussianBlur(buffer, out) {
  // Smooth values over to fill in gaps in the mapping
  out[0] = 0.4 * buffer[0] + 0.5 * buffer[1] + 0.1 * buffer[1];
  out[1] = 0.25 * buffer[0] + 0.4 * buffer[1] + 0.25 * buffer[2] +
    0.1 * buffer[3];

  for (var i = 2; i < buffer.length - 2; i++) {
    out[i] = 0.05 * buffer[i - 2] + 0.25 * buffer[i - 1] +
      0.4 * buffer[i] + 0.25 * buffer[i + 1] + 0.05 * buffer[i + 2];
  }

  var len = buffer.length;
  out[len - 2] = 0.25 * buffer[len - 1] + 0.4 * buffer[len - 2] +
    0.25 * buffer[len - 3] + 0.1 * buffer[len - 4];
  out[len - 1] = 0.4 * buffer[len - 1] + 0.5 * buffer[len - 2] +
    0.1 * buffer[len - 3];
}

/**
 * Scissors
 *
 * Ref: Eric N. Mortensen, William A. Barrett, Interactive Segmentation with
 *   Intelligent Scissors, Graphical Models and Image Processing, Volume 60,
 *   Issue 5, September 1998, Pages 349-384, ISSN 1077-3169,
 *   DOI: 10.1006/gmip.1998.0480.
 *
 * {@link http://www.sciencedirect.com/science/article/B6WG4-45JB8WN-9/2/6fe59d8089fd1892c2bfb82283065579}
 *
 * Highly inspired from {@link http://code.google.com/p/livewire-javascript/}
 *
 * @class
 */
export class Scissors {

  constructor() {
    this.width = -1;
    this.height = -1;

    this.curPoint = null; // Corrent point we're searching on.
    this.searchGranBits = 8; // Bits of resolution for BucketQueue.
    this.searchGran = 1 << this.earchGranBits; //bits.
    this.pointsPerPost = 500;

    // Precomputed image data. All in ranges 0 >= x >= 1 and
    //   all inverted (1 - x).
    this.greyscale = null; // Greyscale of image
    this.laplace = null; // Laplace zero-crossings (either 0 or 1).
    this.gradient = null; // Gradient magnitudes.
    this.gradX = null; // X-differences.
    this.gradY = null; // Y-differences.

    // Matrix mapping point => parent along shortest-path to root.
    this.parents = null;

    this.working = false; // Currently computing shortest paths?

    // Begin Training:
    this.trained = false;
    this.trainingPoints = null;

    this.edgeWidth = 2;
    this.trainingLength = 32;

    this.edgeGran = 256;
    this.edgeTraining = null;

    this.gradPointsNeeded = 32;
    this.gradGran = 1024;
    this.gradTraining = null;

    this.insideGran = 256;
    this.insideTraining = null;

    this.outsideGran = 256;
    this.outsideTraining = null;
  }
  // End Training


  // Begin training methods //
  getTrainingIdx(granularity, value) {
    return Math.round((granularity - 1) * value);
  }

  getTrainedEdge(edge) {
    return this.edgeTraining[this.getTrainingIdx(this.edgeGran, edge)];
  }

  getTrainedGrad(grad) {
    return this.gradTraining[this.getTrainingIdx(this.gradGran, grad)];
  }

  getTrainedInside(inside) {
    return this.insideTraining[this.getTrainingIdx(this.insideGran, inside)];
  }

  getTrainedOutside(outside) {
    return this.outsideTraining[this.getTrainingIdx(this.outsideGran, outside)];
  }
  // End training methods //

  setWorking(working) {
    // Sets working flag
    this.working = working;
  }

  setDimensions(width, height) {
    this.width = width;
    this.height = height;
  }

  setData(data) {
    if (this.width === -1 || this.height === -1) {
      // The width and height should have already been set
      throw new Error('Dimensions have not been set.');
    }

    this.greyscale = computeGreyscale(data, this.width, this.height);
    this.laplace = computeLaplace(this.greyscale);
    this.gradient = computeGradient(this.greyscale);
    this.gradX = computeGradX(this.greyscale);
    this.gradY = computeGradY(this.greyscale);

    var sides = computeSides(
      this.edgeWidth, this.gradX, this.gradY, this.greyscale);
    this.inside = sides.inside;
    this.outside = sides.outside;
    this.edgeTraining = [];
    this.gradTraining = [];
    this.insideTraining = [];
    this.outsideTraining = [];
  }

  findTrainingPoints(p) {
    // Grab the last handful of points for training
    var points = [];

    if (this.parents !== null) {
      for (var i = 0; i < this.trainingLength && p; i++) {
        points.push(p);
        p = this.parents[p.y][p.x];
      }
    }

    return points;
  }

  resetTraining() {
    this.trained = false; // Training is ignored with this flag set
  }

  doTraining(p) {
    // Compute training weights and measures
    this.trainingPoints = this.findTrainingPoints(p);

    if (this.trainingPoints.length < 8) {
      return; // Not enough points, I think. It might crash if length = 0.
    }

    var buffer = [];
    this.calculateTraining(
      buffer, this.edgeGran, this.greyscale, this.edgeTraining);
    this.calculateTraining(
      buffer, this.gradGran, this.gradient, this.gradTraining);
    this.calculateTraining(
      buffer, this.insideGran, this.inside, this.insideTraining);
    this.calculateTraining(
      buffer, this.outsideGran, this.outside, this.outsideTraining);

    if (this.trainingPoints.length < this.gradPointsNeeded) {
      // If we have two few training points, the gradient weight map might not
      // be smooth enough, so average with normal weights.
      this.addInStaticGrad(this.trainingPoints.length, this.gradPointsNeeded);
    }

    this.trained = true;
  }

  calculateTraining(
    buffer, granularity, input, output) {
    var i = 0;
    // Build a map of raw-weights to trained-weights by favoring input values
    buffer.length = granularity;
    for (i = 0; i < granularity; i++) {
      buffer[i] = 0;
    }

    var maxVal = 1;
    for (i = 0; i < this.trainingPoints.length; i++) {
      var p = this.trainingPoints[i];
      var idx = this.getTrainingIdx(granularity, input[p.y][p.x]);
      buffer[idx] += 1;

      maxVal = Math.max(maxVal, buffer[idx]);
    }

    // Invert and scale.
    for (i = 0; i < granularity; i++) {
      buffer[i] = 1 - buffer[i] / maxVal;
    }

    // Blur it, as suggested. Gets rid of static.
    gaussianBlur(buffer, output);
  }

  addInStaticGrad(have, need) {
    // Average gradient raw-weights to trained-weights map with standard weight
    // map so that we don't end up with something to spiky
    for (var i = 0; i < this.gradGran; i++) {
      this.gradTraining[i] = Math.min(
        this.gradTraining[i],
        1 - i * (need - have) / (need * this.gradGran)
      );
    }
  }

  gradDirection(px, py, qx, qy) {
    return gradDirection(this.gradX, this.gradY, px, py, qx, qy);
  }

  dist(px, py, qx, qy) {
    // The grand culmunation of most of the code: the weighted distance function
    var grad = this.gradient[qy][qx];

    if (px === qx || py === qy) {
      // The distance is Euclidean-ish; non-diagonal edges should be shorter
      grad *= Math.SQRT1_2;
    }

    var lap = this.laplace[qy][qx];
    var dir = this.gradDirection(px, py, qx, qy);

    if (this.trained) {
      // Apply training magic
      var gradT = this.getTrainedGrad(grad);
      var edgeT = this.getTrainedEdge(this.greyscale[py][px]);
      var insideT = this.getTrainedInside(this.inside[py][px]);
      var outsideT = this.getTrainedOutside(this.outside[py][px]);

      return 0.3 * gradT + 0.3 * lap + 0.1 * (dir + edgeT + insideT + outsideT);
    } else {
      // Normal weights
      return 0.43 * grad + 0.43 * lap + 0.11 * dir;
    }
  }

  adj(p) {
    var list = [];

    var sx = Math.max(p.x - 1, 0);
    var sy = Math.max(p.y - 1, 0);
    var ex = Math.min(p.x + 1, this.greyscale[0].length - 1);
    var ey = Math.min(p.y + 1, this.greyscale.length - 1);

    var idx = 0;
    for (var y = sy; y <= ey; y++) {
      for (var x = sx; x <= ex; x++) {
        if (x !== p.x || y !== p.y) {
          list[idx++] = {x: x, y: y};
        }
      }
    }

    return list;
  }

  setPoint(sp) {
    this.setWorking(true);

    this.curPoint = sp;

    var x = 0;
    var y = 0;

    this.visited = [];
    for (y = 0; y < this.height; y++) {
      this.visited[y] = [];
      for (x = 0; x < this.width; x++) {
        this.visited[y][x] = false;
      }
    }

    this.parents = [];
    for (y = 0; y < this.height; y++) {
      this.parents[y] = [];
    }

    this.cost = [];
    for (y = 0; y < this.height; y++) {
      this.cost[y] = [];
      for (x = 0; x < this.width; x++) {
        this.cost[y][x] = Number.MAX_VALUE;
      }
    }

    this.pq = new BucketQueue(this.searchGranBits, function (p) {
      return Math.round(this.searchGran * this.costArr[p.y][p.x]);
    });
    this.pq.searchGran = this.searchGran;
    this.pq.costArr = this.cost;

    this.pq.push(sp);
    this.cost[sp.y][sp.x] = 0;
  }

  doWork() {
    if (!this.working) {
      return;
    }

    this.timeout = null;

    var pointCount = 0;
    var newPoints = [];
    while (!this.pq.isEmpty() && pointCount < this.pointsPerPost) {
      var p = this.pq.pop();
      newPoints.push(p);
      newPoints.push(this.parents[p.y][p.x]);

      this.visited[p.y][p.x] = true;

      var adjList = this.adj(p);
      for (var i = 0; i < adjList.length; i++) {
        var q = adjList[i];

        var pqCost = this.cost[p.y][p.x] + this.dist(p.x, p.y, q.x, q.y);

        if (pqCost < this.cost[q.y][q.x]) {
          if (this.cost[q.y][q.x] !== Number.MAX_VALUE) {
            // Already in PQ, must remove it so we can re-add it.
            this.pq.remove(q);
          }

          this.cost[q.y][q.x] = pqCost;
          this.parents[q.y][q.x] = p;
          this.pq.push(q);
        }
      }

      pointCount++;
    }

    return newPoints;
  }

} // Scissors class
