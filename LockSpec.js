
import Lock from './Lock'
import TimeoutError from './TimeoutError'

describe('Lock', () => {

  /**
   * @type {Lock}
   */
  let lock

  beforeEach(() => {
    lock = new Lock()
  })

  it('should generate its name automatically if none is provided', () => {
    expect(/Lock:[0-9a-z]+:[0-9a-z]+/.test(lock.name)).toBeTruthy()
  })

  it('should accept its name as the first constructor argument', () => {
    let name = 'generated lock name ' + Date.now() + Math.random()
    lock = new Lock(name)
    expect(lock.name).toBe(name)
  })

  it('should reject a non-string name', () => {
    let invalidNames = [null, 1, true, {}, []]
    for (let invalidName of invalidNames) {
      expect(() => new Lock(invalidName)).toThrowError(TypeError)
    }
  })

  it('should reject an empty string as a name', () => {
    expect(() => new Lock('')).toThrowError(Error)
  })

  it('should seal its instance', () => {
    expect(() => lock.test = 1).toThrow()
  })

  it('should not be locked when created', () => {
    expect(lock.isLocked).toBe(false)
  })

  it('should reject non-function tasks', async (done) => {
    let invalidTasks = [null, 1, '', true, {}, []]
    for (let invalidTask of invalidTasks) {
      try {
        await lock.lock(invalidTask)
        fail()
      } catch (error) {
        expect(error instanceof TypeError).toBe(true)
      }
    }
    done()
  })

  it('should reject non-integer or negative timeouts', async (done) => {
    let invalidTimeouts = [null, true, '', 1.2, {}, []]
    for (let invalidTimeout of invalidTimeouts) {
      try {
        await lock.lock(() => {}, invalidTimeout)
        fail()
      } catch (error) {
        expect(error instanceof TypeError).toBe(true)
      }
    }

    try {
      await lock.lock(() => {}, -1)
      fail()
    } catch (error) {
      expect(error instanceof RangeError).toBe(true)
    }

    done()
  })

  it('should be locked only during task execution', async (done) => {
    expect(lock.isLocked).toBe(false)
    let executed = false
    await lock.lock(() => {
      expect(lock.isLocked).toBe(true)
      executed = true
    })
    expect(executed).toBe(true)
    done()
  })

  it('should accept 0 as timeout', async (done) => {
    // It is pretty much impossible to test whether the API would wait
    // indefinitely, so we have to settle for accepting 0 at all.
    let executed = false
    await lock.lock(() => {
      executed = true
    }, 0)
    expect(executed).toBe(true)
    done()
  })

  it('should reject after waiting longer than timeout', async (done) => {
    let firstTaskPromise = lock.lock(
      () => new Promise(resolve => setTimeout(resolve, 100))
    )
    try {
      await lock.lock(() => {}, 10)
      fail()
    } catch (error) {
      expect(error instanceof TimeoutError).toBe(true)
    }
    expect(lock.isLocked).toBe(true)
    await firstTaskPromise
    done()
  })

  it('should execute the task once', async (done) => {
    let executionCounter = 0
    await lock.lock(() => executionCounter++)
    expect(executionCounter).toBe(1)
    done()
  })

  it('should preserve the order of the tasks', async (done) => {
    let executedTasks = []
    lock.lock(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          executedTasks.push('a')
          resolve()
        }, 10)
      })
    })
    lock.lock(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          executedTasks.push('b')
          resolve()
        }, 20)
      })
    })
    await lock.lock(() => {
      return new Promise((resolve) => {
        setTimeout(() => {
          executedTasks.push('c')
          resolve()
        }, 5)
      })
    })

    expect(executedTasks).toEqual(['a', 'b', 'c'])
    done()
  })

  afterEach(() => {
    expect(lock.isLocked).toBe(false)
  })

})
