
import TimeoutError from './TimeoutError'

/**
 * Private field symbols.
 *
 * @type {Object<string, symbol>}
 */
const PRIVATE = Object.freeze({
  locked: Symbol('locked'),
  taskTriggerQueue: Symbol('taskTriggerQueue')
})

/**
 * A simple locking mechanism for synchronizing tasks performed in async
 * functions.
 */
export default class Lock {
  /**
   * Initializes the lock.
   *
   * @param {string=} lockName The name of this lock. The name must not be an
   *        empty string and should be unique to help identify the lock in
   *        timeout error messages.
   */
  constructor(lockName = generateLockName()) {
    if (typeof lockName !== 'string') {
      throw new TypeError(
        `The lock name must be a non-empty string, ${lockName} was provided`
      )
    }
    if (!lockName) {
      throw new Error(
        'The lock name must be a non-empty string, but an empty string was ' +
        'provided'
      )
    }

    /**
     * The name of this lock.
     *
     * @type {string}
     */
    this.name = lockName
    Object.defineProperty(this, 'name', {
      configurable: false,
      enumerable: false,
      writable: false
    })

    /**
     * Whether or not is this lock currently locked.
     *
     * @type {boolean}
     */
    this[PRIVATE.locked] = false
    Object.defineProperty(this, PRIVATE.locked, {
      configurable: false,
      enumerable: false
    })

    /**
     * The queue of task resume callback for tasks that are waiting for the lock.
     *
     * @type {function()[]}
     */
    this[PRIVATE.taskTriggerQueue] = []
    Object.defineProperty(this, PRIVATE.taskTriggerQueue, {
      configurable: false,
      enumerable: false,
      writable: false
    })

    Object.seal(this)
  }

  /**
   * Returns {@code true} when this lock is currently locked by an active task.
   *
   * @return {boolean} {@code true} when this lock is currently locked by an
   *         active task.
   */
  get isLocked() {
    return this[PRIVATE.locked]
  }

  /**
   * Executes the provided task by acquiring this lock for the test (once
   * available), running the task, releasing the lock and returning the task's
   * result.
   *
   * @template R
   * @param {function(): (R|Promise<R>)} task The task that should be performed
   *        synchronized by this lock.
   * @param {number=} timeout The maximum number of milliseconds the task
   *        should wait for the lock to be acquired. Should the task time out,
   *        the method will throw a {@linkcode TimeoutError}.
   *        The {@code timeout} can be set to 0 if the task may way
   *        indefinitely (this is not recommended). Defaults to 60 seconds.
   * @return {R} The result of the provided task.
   */
  async lock(task, timeout = 60000) {
    if (!(task instanceof Function)) {
      throw new TypeError(
        `The task has to be a function, ${task} has been provided`
      )
    }
    if ((typeof timeout !== 'number') || (Math.floor(timeout) !== timeout)) {
      throw new TypeError(
        `The timeout has to be a non-negative integer, ${timeout} has been ` +
        `provided`
      )
    }
    if (timeout < 0) {
      throw new RangeError(
        `The timeout has to be a non-negative integer, ${timeout} has been ` +
        `provided`
      )
    }

    if (this[PRIVATE.locked]) {
      await new Promise((resolve, reject) => {
        this[PRIVATE.taskTriggerQueue].push(resolve)

        if (timeout) {
          setTimeout(() => reject(new TimeoutError(
            `The provided task did not acquire the ${this.name} lock within ` +
            `the specified timeout of ${timeout} milliseconds`
          )), timeout)
        }
      })
    } else {
      this[PRIVATE.locked] = true
    }

    try {
      return await task()
    } catch (error) {
      throw error
    } finally {
      if (this[PRIVATE.taskTriggerQueue].length) {
        let trigger = this[PRIVATE.taskTriggerQueue].shift()
        trigger()
      } else {
        this[PRIVATE.locked] = false
      }
    }
  }

  /**
   * Attempts to acquire all of the specified locks within the specified
   * timeout before executing the provided task. The task will be executed only
   * if all of the locks are acquired within the time limit.
   *
   * The locks are acquired in lexicographical order of their names (the names
   * of the provided locks must be unique) in order to prevent deadlocks in the
   * application (should the timeout be set to 0, which is not recommended).
   *
   * @template R
   * @param {Lock[]} locks The locks that must be acquired before the task can
   *        be executed. The array must not be empty.
   * @param {function(): (R|Promise<R>)} task The task to execute once all of
   *        the specified locks have been acquired.
   * @param {number=} timeout The maximum number of milliseconds the task may
   *        wait to acquire all locks. Should the task time out, the method
   *        will throw a {@linkcode TimeoutError}.
   *        The {@code timeout} can be set to 0 if the task may way
   *        indefinitely (this is not recommended). Defaults to 60 seconds.
   */
  static async all(locks, task, timeout = 60000) {
    if (!(locks instanceof Array)) {
      throw new TypeError(
        `The locks must be an array of Lock instances, ${locks} has been ` +
        `provided`
      )
    }
    if (locks.some(lock => !(lock instanceof Lock))) {
      throw new TypeError(
          `The locks must be an array of Lock instances, ${locks} has been ` +
          `provided`
      )
    }
    if (!(task instanceof Function)) {
      throw new TypeError(
        `The task must be a function, ${task} has been provided`
      )
    }
    if ((typeof timeout !== 'number') || (Math.floor(timeout) !== timeout)) {
      throw new TypeError(
        `The timeout has to be a non-negative integer, ${timeout} has been ` +
        `provided`
      )
    }
    if (!locks.length) {
      throw new RangeError('The array of locks cannot be empty')
    }
    if ((new Set(locks.map(lock => lock.name))).size !== locks.length) {
      throw new Error(
        'The names of the locks to acquire must be unique to ensure a ' +
        'deadlock would not occur'
      )
    }
    if (timeout < 0) {
      throw new RangeError(
        `The timeout has to be a non-negative integer, ${timeout} has been ` +
        `provided`
      )
    }

    if (locks.length === 1) {
      return await locks[0].lock(task, timeout)
    }

    let sortedLocks = locks.slice().sort(lock => lock.name)
    let nextLock = sortedLocks.slice().shift()
    let waitStart = Date.now()
    return await nextLock.lock(async () => {
      let timeWaited = Date.now() - waitStart
      let remainingTime = Math.max(timeout - timeWaited, 1)
      return await Lock.all(sortedLocks.slice(1), task, remainingTime)
    }, timeout)
  }
}

/**
 * Generates a new, most likely unique, name for a freshly created lock that
 * was not provided with a custom name.
 *
 * @return {string} The generated name for the lock.
 */
function generateLockName() {
  let subMark = Math.floor(Math.random() * 1000).toString(36)
  return `Lock:${Date.now().toString(36)}:${subMark}`
}
