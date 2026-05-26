import assert from 'node:assert/strict'
import { createRED } from './helpers/red-mock.js'
import registerFlattenDelta from '../signalk-flatten-delta.js'

describe('signalk-flatten-delta', () => {
  let node

  beforeEach(() => {
    const { RED, registeredTypes } = createRED()
    registerFlattenDelta(RED)
    node = {}
    registeredTypes['signalk-flatten-delta'].call(node, { id: 'n1' })
  })

  it('sends one message per path/value pair in a single update', () => {
    const delta = {
      context: 'vessels.self',
      updates: [
        {
          $source: 'test.1',
          source: { label: 'test' },
          values: [
            { path: 'navigation.speedOverGround', value: 1.5 },
            { path: 'navigation.courseOverGroundTrue', value: 0.5 }
          ]
        }
      ]
    }

    node._trigger('input', { payload: delta })

    assert.equal(node.send.callCount, 2)
  })

  it('sets topic, payload, $source, source, and context correctly', () => {
    const delta = {
      context: 'vessels.self',
      updates: [
        {
          $source: 'radar.0',
          source: { label: 'radar' },
          values: [{ path: 'navigation.speedOverGround', value: 3.5 }]
        }
      ]
    }

    node._trigger('input', { payload: delta })

    const msg = node.send.getCall(0).args[0]
    assert.equal(msg.topic, 'navigation.speedOverGround')
    assert.equal(msg.payload, 3.5)
    assert.equal(msg.$source, 'radar.0')
    assert.deepEqual(msg.source, { label: 'radar' })
    assert.equal(msg.context, 'vessels.self')
  })

  it('sends messages across multiple updates', () => {
    const delta = {
      context: 'vessels.self',
      updates: [
        { $source: 'src1', values: [{ path: 'path.one', value: 1 }] },
        { $source: 'src2', values: [{ path: 'path.two', value: 2 }] }
      ]
    }

    node._trigger('input', { payload: delta })

    assert.equal(node.send.callCount, 2)
    assert.equal(node.send.getCall(0).args[0].$source, 'src1')
    assert.equal(node.send.getCall(1).args[0].$source, 'src2')
  })

  it('ignores updates that have no values array', () => {
    const delta = {
      updates: [{ $source: 'src' }]
    }

    node._trigger('input', { payload: delta })

    assert.equal(node.send.callCount, 0)
  })

  it('ignores payload with no updates property', () => {
    node._trigger('input', { payload: {} })

    assert.equal(node.send.callCount, 0)
  })
})
