# js-lock

The `js-lock` provides an object-oriented synchronization lock API for ES2017.
While JavaScript itself is single-threaded, many operations are asynchronous,
while leads to the need to sometimes synchronize various operations.

There are already various other libraries providing the tools necessary for
such synchronization, but none of them provides object-oriented ES2017 API at
the time of writing this. This is where `js-lock` comes in.

## Example usage

```javascript
import Lock from 'js-lock'

let lock = new Lock(/* optional lock name, should be unique */)
lock.name // the name of the lock
lock.isLocked // false

// The second argument is the optional maximum time the task (provided callback
// function) may wait to acquire the lock in milliseconds. Should the task fail
// to acquire the lock in such time, the lock method would throw a
// TimeoutError.
await lock.lock(async () => {
  lock.isLocked // true
  // ...
}, 10000)

lock.isLocked // false

let otherLock = new Lock()

// The Lock.all API is used to acquire multiple locks before executing a task.
// The locks are aquired in lexicographical order of their names in order to
// prevent possible deadlocks, which is why the names of the locks passed to
// this method must be unique.
Lock.all([lock, otherLock], async () => {
  // ...
}, 10000 /* optional timeout, see above */)
```

While the `Lock` constructor can automatically generate very likely to be
unique names, such pseudo-random names are hard to read and make identifying
the lock at hand hard to identify when handling errors. Because of this, it is
recommended to always name your locks yourself.
