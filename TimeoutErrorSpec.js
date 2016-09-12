
import TimeoutError from './TimeoutError'

describe('TimeoutError', () => {

  it('should not require an argument for its constructor', () => {
    new TimeoutError()
  })

  it('should have its name set to "TimeoutError"', () => {
    let error = new TimeoutError()
    expect(error.name).toBe('TimeoutError')
  })

  it('should accept a message as the constructor argument', () => {
    let message = 'testing message ' + Math.random() + Date.now()
    let error = new TimeoutError(message)
    expect(error.message).toBe(message)
  })

})
