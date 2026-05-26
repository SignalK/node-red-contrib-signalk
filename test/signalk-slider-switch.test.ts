import assert from 'node:assert/strict'
import sinon from 'sinon'
import { createRED, createMockServer } from './helpers/red-mock.js'
import registerSliderSwitch from '../signalk-slider-switch.js'

describe('signalk-slider-switch', () => {
  let server, node, clock

  beforeEach(() => {
    clock = sinon.useFakeTimers()
    server = createMockServer()
    const { RED, registeredTypes } = createRED({ 'server-id': server })
    registerSliderSwitch(RED)
    node = {}
    registeredTypes['signalk-slider-switch'].call(node, {
      id: 'n1',
      server: 'server-id',
      path: 'electrical.fans.cabin',
      rangeMin: '0',
      rangeMax: '100',
      displayName: 'Cabin Fan'
    })
  })

  afterEach(() => {
    node._trigger('close')
    clock.restore()
  })

  it('registers a PUT handler for the .state path', () => {
    assert.equal(server.registerPutHandler.callCount, 1)
    const [, path] = server.registerPutHandler.getCall(0).args
    assert.equal(path, 'electrical.fans.cabin.state')
  })

  it('PUT handler accepts a value within range and returns COMPLETED/200', () => {
    const handler = server.registerPutHandler.getCall(0).args[2]

    const result = handler(
      'vessels.self',
      'electrical.fans.cabin.state',
      50,
      'cb'
    )

    assert.equal(result.state, 'COMPLETED')
    assert.equal(result.statusCode, 200)
    assert.equal(node.send.getCall(0).args[0].payload, 50)
  })

  it('PUT handler rejects a value outside the range with COMPLETED/400', () => {
    const handler = server.registerPutHandler.getCall(0).args[2]

    const result = handler(
      'vessels.self',
      'electrical.fans.cabin.state',
      150,
      'cb'
    )

    assert.equal(result.state, 'COMPLETED')
    assert.equal(result.statusCode, 400)
    assert.equal(node.send.callCount, 0)
  })

  it('PUT handler returns PENDING/202 when config.pending is true', () => {
    const { RED, registeredTypes } = createRED({ 'server-id': server })
    registerSliderSwitch(RED)
    const n = {}
    registeredTypes['signalk-slider-switch'].call(n, {
      id: 'n2',
      server: 'server-id',
      path: 'some.path',
      rangeMin: '0',
      rangeMax: '10',
      pending: true
    })
    const handler = server.registerPutHandler.lastCall.args[2]

    const result = handler('vessels.self', 'some.path.state', 5, 'cb-id')

    assert.equal(result.state, 'PENDING')
    assert.equal(result.statusCode, 202)
    assert.equal(n.send.getCall(0).args[0].cbInfo, 'cb-id')
    n._trigger('close')
  })

  it('input handler sends valid value', () => {
    node._trigger('input', { payload: 75 })

    assert.equal(node.send.callCount, 1)
    assert.equal(node.send.getCall(0).args[0].payload, 75)
  })

  it('input handler rejects value outside range', () => {
    node._trigger('input', { payload: -1 })

    assert.equal(node.send.callCount, 0)
    assert.equal(node.error.callCount, 1)
  })

  it('sends meta with rangeMin, rangeMax, and supportsPut on available', () => {
    server.emit('available')

    const metaCall = server.handleMessage
      .getCalls()
      .find((c) => c.args[1].updates[0].meta)
    assert(metaCall, 'expected a meta delta')
    const metaValue = metaCall.args[1].updates[0].meta[0].value
    assert.equal(metaValue.rangeMin, 0)
    assert.equal(metaValue.rangeMax, 100)
    assert.equal(metaValue.supportsPut, true)
  })

  it('includes stepSize in meta when config.stepSize is set', () => {
    // Use a fresh server so the beforeEach node's available listener doesn't
    // interfere with the meta call search.
    const freshServer = createMockServer()
    const { RED, registeredTypes } = createRED({ 'server-id': freshServer })
    registerSliderSwitch(RED)
    const n = {}
    registeredTypes['signalk-slider-switch'].call(n, {
      id: 'n3',
      server: 'server-id',
      path: 'some.path',
      rangeMin: '0',
      rangeMax: '10',
      stepSize: '1'
    })
    freshServer.emit('available')

    const metaCall = freshServer.handleMessage
      .getCalls()
      .find((c) => c.args[1].updates[0].meta)
    assert.equal(metaCall.args[1].updates[0].meta[0].value.stepSize, 1)
    n._trigger('close')
  })

  it('clears resend interval on close', () => {
    server.emit('available')
    node._trigger('close')

    const countBefore = server.handleMessage.callCount
    clock.tick(10000)
    assert.equal(server.handleMessage.callCount, countBefore)
  })
})
