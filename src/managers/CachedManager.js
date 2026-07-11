'use strict';

const DataManager = require('./DataManager');
const { _cleanupSymbol } = require('../util/Constants');

/**
 * Manages the API methods of a data model with a mutable cache of instances.
 * @extends {DataManager}
 * @abstract
 */
class CachedManager extends DataManager {
  constructor(client, holds, iterable) {
    super(client, holds);

    /**
     * The private cache of items for this manager.
     * @type {Collection}
     * @private
     * @readonly
     * @name CachedManager#_cache
     */
    Object.defineProperty(this, '_cache', { value: this.client.options.makeCache(this.constructor, this.holds) });

    /**
     * Whether this manager's cache has been disabled via `ClientOptions#disabledManagers`.
     * When true, `_add` never writes to the cache. The cache itself remains a genuine Collection,
     * so `get`/`set`/`has`/iteration and sweeper timers keep working normally (no lying proxy).
     * @type {boolean}
     * @private
     * @readonly
     */
    const disabledManagers = Array.isArray(this.client.options.disabledManagers)
      ? this.client.options.disabledManagers
      : [];
    Object.defineProperty(this, '_disabled', { value: disabledManagers.includes(this.constructor.name) });

    let cleanup = this._cache[_cleanupSymbol]?.();
    if (cleanup) {
      cleanup = cleanup.bind(this._cache);
      client._cleanups.add(cleanup);
      client._finalizers.register(this, {
        cleanup,
        message:
          `Garbage collection completed on ${this.constructor.name}, ` +
          `which had a ${this._cache.constructor.name} of ${this.holds.name}.`,
        name: this.constructor.name,
      });
    }

    if (iterable) {
      for (const item of iterable) {
        this._add(item);
      }
    }
  }

  /**
   * The cache of items for this manager.
   * @type {Collection}
   * @abstract
   */
  get cache() {
    return this._cache;
  }

  _add(data, cache = true, { id, extras = [] } = {}) {
    // Disabled managers: force cache off so nothing is ever retained, but still construct and
    // return a transient instance so callers that use the return value keep working. We never
    // touch this.cache with a conditional write, preserving the Collection's Map contract.
    if (this._disabled) cache = false;

    const existing = this.cache.get(id ?? data.id);
    if (existing) {
      if (cache) {
        existing._patch(data);
        return existing;
      }
      const clone = existing._clone();
      clone._patch(data);
      return clone;
    }

    const entry = this.holds ? new this.holds(this.client, data, ...extras) : data;
    if (cache) this.cache.set(id ?? entry.id, entry);
    return entry;
  }
}

module.exports = CachedManager;
