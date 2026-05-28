import assert from 'node:assert/strict'
import { createRED } from './helpers/red-mock.js'
import registerFilterDelta from '../dist/signalk-filter-delta.js'

describe('signalk-filter-delta', () => {
  let node

  beforeEach(() => {
    const { RED, registeredTypes } = createRED()
    registerFilterDelta(RED)
    node = {}
    registeredTypes['signalk-filter-delta'].call(node, {
      id: 'n1',
      path: 'navigation.speedOverGround'
    })
  })

  it('passes through updates matching the configured path', () => {
    const delta = {
      updates: [
        {
          $source: 'other.source',
          values: [{ path: 'navigation.speedOverGround', value: 1.5 }]
        }
      ]
    }

    node._trigger('input', { payload: delta })

    assert.equal(node.send.callCount, 1)
    assert.equal(
      node.send.getCall(0).args[0].payload.path,
      'navigation.speedOverGround'
    )
    assert.equal(node.send.getCall(0).args[0].payload.value, 1.5)
  })

  it('filters out updates whose path does not match', () => {
    const delta = {
      updates: [
        {
          $source: 'other.source',
          values: [{ path: 'navigation.courseOverGroundTrue', value: 0.5 }]
        }
      ]
    }

    node._trigger('input', { payload: delta })

    assert.equal(node.send.callCount, 0)
  })

  it('filters out updates from signalk-node-red source', () => {
    const delta = {
      updates: [
        {
          $source: 'signalk-node-red',
          values: [{ path: 'navigation.speedOverGround', value: 1.5 }]
        }
      ]
    }

    node._trigger('input', { payload: delta })

    assert.equal(node.send.callCount, 0)
  })

  it('also filters updates whose $source starts with signalk-node-red', () => {
    const delta = {
      updates: [
        {
          $source: 'signalk-node-red.plugin',
          values: [{ path: 'navigation.speedOverGround', value: 1.5 }]
        }
      ]
    }

    node._trigger('input', { payload: delta })

    assert.equal(node.send.callCount, 0)
  })

  it('passes updates that have no $source', () => {
    const delta = {
      updates: [
        {
          values: [{ path: 'navigation.speedOverGround', value: 2.0 }]
        }
      ]
    }

    node._trigger('input', { payload: delta })

    assert.equal(node.send.callCount, 1)
  })

  it('copies $source and source onto the output payload', () => {
    const delta = {
      updates: [
        {
          $source: 'radar.0',
          source: { label: 'radar' },
          values: [{ path: 'navigation.speedOverGround', value: 1.5 }]
        }
      ]
    }

    node._trigger('input', { payload: delta })

    const result = node.send.getCall(0).args[0].payload
    assert.equal(result.$source, 'radar.0')
    assert.deepEqual(result.source, { label: 'radar' })
  })
})
