
import TimeoutError from "./TimeoutError"

/**
 * Private field symbols.
 *
 * @type {Object<string, symbol>}
 */
const PRIVATE = Object.freeze({
  locked: Symbol("locked"),
  taskTriggerQueue: Symbol("taskTriggerQueue")
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
    if (typeof lockName !== "string") {
      throw new TypeError(
          `The lock name must be a non-empty string, ${lockName} was provided`
      )
    }
    if (!lockName) {
      throw new Error(
          "The lock name must be a non-empty string, but an empty string " +
          "was provided"
      )
    }

    /**
     * The name of this lock.
     *
     * @type {string}
     */
    this.name = lockName
    Object.defineProperty(this, "name", {
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
    Object.defineProperty(this, PRIVATE.taskTriggerQueue, {
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
    if ((typeof timeout !== "number") || (Math.floor(timeout) !== timeout)) {
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

    let result = await task()

    if (this[PRIVATE.taskTriggerQueue].length) {
      let trigger = this[PRIVATE.taskTriggerQueue].shift()
      trigger()
    } else {
      this[PRIVATE.locked] = false
    }

    return result
  }
}

function generateLockName() {
  let subMark = Math.floor(Math.random() * 1000).toString(36)
  return `Lock:${Date.now().toString(36)}:${subMark}`
}
