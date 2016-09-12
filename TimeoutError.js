
/**
 * The {@code TimeoutError} represents an error thrown when an operation that
 * has a time limit has timed out (exceeded its time limit).
 */
export default class TimeoutError extends Error {
  /**
   * Initializes the timeout error.
   *
   * @param {string=} message The message that describes the cause of the
   *        error.
   */
  constructor(message = '') {
    super(message)

    this.name = 'TimeoutError'
  }
}
