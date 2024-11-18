// Constants
const PROTECTED_KEYS = ['constructor', 'prototype', '__proto__'];
const DEFAULT_OPTIONS = {
  symbols: false,
  cloneProtoObject: null,
  mergeArray: null,
  all: false,
};

/**
 * Creates an object merge utility with custom configuration
 * @param {Object} options - Configuration options
 * @returns {Function} Configured merge function
 */
module.exports = function createObjectMerger(options = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options };

  /**
   * Gets enumerable keys for an object, optionally including symbols
   * @param {Object} obj - Target object
   * @returns {Array} Array of keys/symbols
   */
  const getKeys = config.symbols
    ? obj => {
        const keys = Object.keys(obj);
        const symbols = Object.getOwnPropertySymbols(obj);
        return symbols.reduce((acc, sym) => {
          if (Object.prototype.propertyIsEnumerable.call(obj, sym)) {
            acc.push(sym);
          }
          return acc;
        }, keys);
      }
    : Object.keys;

  /**
   * Checks if a value is a primitive type
   * @param {*} value - Value to check
   * @returns {boolean}
   */
  const isPrimitive = value => typeof value !== 'object' || value === null;

  /**
   * Checks if a key is not a protected prototype key
   * @param {string|symbol} key - Key to check
   * @returns {boolean}
   */
  const isNotPrototypeKey = key => !PROTECTED_KEYS.includes(key);

  /**
   * Checks if an object can be merged
   * @param {*} value - Value to check
   * @returns {boolean}
   */
  const canMerge = value => {
    if (isPrimitive(value)) return false;

    // Check if it's not a built-in type
    return !(
      value instanceof RegExp ||
      value instanceof Date ||
      (typeof Buffer !== 'undefined' && value instanceof Buffer)
    );
  };

  /**
   * Deep clones an object or array
   * @param {*} value - Value to clone
   * @returns {*} Cloned value
   */
  const clone = value => {
    if (Array.isArray(value)) {
      return value.map(clone);
    }

    if (canMerge(value)) {
      const clonedObj = Object.create(
        config.cloneProtoObject === null ? Object.getPrototypeOf(value) : config.cloneProtoObject
      );

      getKeys(value)
        .filter(isNotPrototypeKey)
        .forEach(key => {
          clonedObj[key] = clone(value[key]);
        });

      return clonedObj;
    }

    return value;
  };

  /**
   * Merges arrays according to configuration
   * @param {Array} target - Target array
   * @param {Array} source - Source array
   * @returns {Array} Merged array
   */
  const mergeArrays = (target, source) => {
    if (typeof config.mergeArray === 'function') {
      return config.mergeArray(target, source);
    }
    return [...source];
  };

  /**
   * Merges two objects deeply
   * @param {Object} target - Target object
   * @param {Object} source - Source object
   * @returns {Object} Merged object
   */
  const merge = (target, source) => {
    const output = { ...target };

    if (!source || !canMerge(source)) {
      return output;
    }

    getKeys(source)
      .filter(isNotPrototypeKey)
      .forEach(key => {
        const sourceValue = source[key];
        const targetValue = target[key];

        if (!config.all && sourceValue === undefined) {
          return;
        }

        if (Array.isArray(sourceValue)) {
          output[key] = mergeArrays(targetValue, sourceValue);
          return;
        }

        if (canMerge(sourceValue)) {
          output[key] = merge(canMerge(targetValue) ? targetValue : {}, sourceValue);
          return;
        }

        output[key] = clone(sourceValue);
      });

    return output;
  };

  return merge;
};
