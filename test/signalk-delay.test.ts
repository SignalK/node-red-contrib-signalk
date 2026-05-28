import assert from 'node:assert/strict'
import sinon from 'sinon'
import { createRED } from './helpers/red-mock.js'
import registerDelay from '../dist/signalk-delay.js'

// Minimal lodash stub — only isEqual is used by this node
const lodashStub = {
  isEqual: (a, b) => JSON.stringify(a) === JSON.stringify(b)
}

describe('signalk-delay', () => {
  let node, clock

  beforeEach(() => {
    // Start at 1000 so Date.now() is truthy — the delay node uses !firstMessage to
    // detect an uninitialised timer, which would break if Date.now() returned 0.
    clock = sinon.useFakeTimers({ now: 1000 })
    const { RED, registeredTypes } = createRED(
      {},
      { globalContext: { lodash: lodashStub } }
    )
    registerDelay(RED)
    node = {}
    registeredTypes['signalk-delay'].call(node, { id: 'n1', delay: 5000 })
  })

  afterEach(() => {
    clock.restore()
  })

  it('does not send on the first message', () => {
    node._trigger('input', { payload: 42 })

    assert.equal(node.send.callCount, 0)
  })

  it('does not send when delay has not yet elapsed', () => {
    node._trigger('input', { payload: 42 })
    clock.tick(4999)
    node._trigger('input', { payload: 42 })

    assert.equal(node.send.callCount, 0)
  })

  it('sends when the same value is received after the delay has passed', () => {
    node._trigger('input', { payload: 42 })
    clock.tick(5001)
    node._trigger('input', { payload: 42 })

    assert.equal(node.send.callCount, 1)
    assert.equal(node.send.getCall(0).args[0].payload, 42)
  })

  it('resets the timer when the value changes', () => {
    node._trigger('input', { payload: 42 })
    clock.tick(4000)

    // Value change resets the timer
    node._trigger('input', { payload: 99 })
    clock.tick(2000) // 2000 ms since reset, not enough

    node._trigger('input', { payload: 99 })
    assert.equal(node.send.callCount, 0)

    clock.tick(3001) // now 5001 ms since reset
    node._trigger('input', { payload: 99 })
    assert.equal(node.send.callCount, 1)
  })

  it('works with object payloads using deep equality', () => {
    const val = { speed: 3.5 }
    node._trigger('input', { payload: val })
    clock.tick(5001)
    node._trigger('input', { payload: { speed: 3.5 } }) // structurally equal

    assert.equal(node.send.callCount, 1)
  })

  it('resets timer when object value changes', () => {
    node._trigger('input', { payload: { speed: 3.5 } })
    clock.tick(5001)
    node._trigger('input', { payload: { speed: 4.0 } }) // changed

    assert.equal(node.send.callCount, 0)
  })
})
