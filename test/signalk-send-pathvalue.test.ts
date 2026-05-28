import assert from 'node:assert/strict'
import { createRED, createMockServer } from './helpers/red-mock.js'
import registerSendPathvalue from '../dist/signalk-send-pathvalue.js'

describe('signalk-send-pathvalue', () => {
  let server, node

  beforeEach(() => {
    server = createMockServer()
    const { RED, registeredTypes } = createRED({ 'server-id': server })
    registerSendPathvalue(RED)
    node = {}
    registeredTypes['signalk-send-pathvalue'].call(node, {
      id: 'n1',
      server: 'server-id',
      path: 'navigation.speedOverGround'
    })
  })

  it('calls server.handleMessage with a delta containing msg.payload', () => {
    node._trigger('input', { payload: 3.5 })

    assert.equal(server.handleMessage.callCount, 1)
    const [, delta] = server.handleMessage.getCall(0).args
    assert.equal(delta.updates[0].values[0].path, 'navigation.speedOverGround')
    assert.equal(delta.updates[0].values[0].value, 3.5)
  })

  it('falls back to msg.topic when config.path is empty', () => {
    const { RED, registeredTypes } = createRED({ 'server-id': server })
    registerSendPathvalue(RED)
    const n = {}
    registeredTypes['signalk-send-pathvalue'].call(n, {
      id: 'n2',
      server: 'server-id',
      path: ''
    })

    n._trigger('input', {
      topic: 'navigation.courseOverGroundTrue',
      payload: 1.0
    })

    const [, delta] = server.handleMessage.getCall(0).args
    assert.equal(
      delta.updates[0].values[0].path,
      'navigation.courseOverGroundTrue'
    )
  })

  it('reports error when neither config.path nor msg.topic is set', () => {
    const { RED, registeredTypes } = createRED({ 'server-id': server })
    registerSendPathvalue(RED)
    const n = {}
    registeredTypes['signalk-send-pathvalue'].call(n, {
      id: 'n3',
      server: 'server-id',
      path: ''
    })

    n._trigger('input', { payload: 1.0 })

    assert.equal(n.error.callCount, 1)
    assert.equal(server.handleMessage.callCount, 0)
  })

  it('sends a meta delta before the value delta when config.meta is set', () => {
    const { RED, registeredTypes } = createRED({ 'server-id': server })
    registerSendPathvalue(RED)
    const n = {}
    registeredTypes['signalk-send-pathvalue'].call(n, {
      id: 'n4',
      server: 'server-id',
      path: 'navigation.speedOverGround',
      meta: JSON.stringify({ units: 'm/s' })
    })

    n._trigger('input', { payload: 2.0 })

    // First call: meta delta; second call: value delta
    assert.equal(server.handleMessage.callCount, 2)
    const metaDelta = server.handleMessage.getCall(0).args[1]
    assert(metaDelta.updates[0].meta, 'first delta should be a meta delta')
    assert.deepEqual(metaDelta.updates[0].meta[0].value, { units: 'm/s' })
  })

  it('sends meta only once per path (not on second input)', () => {
    const { RED, registeredTypes } = createRED({ 'server-id': server })
    registerSendPathvalue(RED)
    const n = {}
    registeredTypes['signalk-send-pathvalue'].call(n, {
      id: 'n5',
      server: 'server-id',
      path: 'navigation.speedOverGround',
      meta: JSON.stringify({ units: 'm/s' })
    })

    n._trigger('input', { payload: 1.0 }) // meta + value
    n._trigger('input', { payload: 2.0 }) // value only

    const metaCalls = server.handleMessage
      .getCalls()
      .filter((c) => c.args[1].updates[0].meta)
    assert.equal(metaCalls.length, 1)
  })

  it('sets $source on the delta when config.source is configured', () => {
    const { RED, registeredTypes } = createRED({ 'server-id': server })
    registerSendPathvalue(RED)
    const n = {}
    registeredTypes['signalk-send-pathvalue'].call(n, {
      id: 'n6',
      server: 'server-id',
      path: 'navigation.speedOverGround',
      source: 'my-source'
    })

    n._trigger('input', { payload: 1.0 })

    const delta = server.handleMessage.getCall(0).args[1]
    assert.equal(delta.updates[0].$source, 'my-source')
  })
})
