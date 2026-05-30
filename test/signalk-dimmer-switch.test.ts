import assert from 'node:assert/strict'
import sinon from 'sinon'
import { createRED, createMockServer } from './helpers/red-mock.js'
import registerDimmerSwitch from '../dist/signalk-dimmer-switch.js'

describe('signalk-dimmer-switch', () => {
  let server, node, clock

  beforeEach(() => {
    clock = sinon.useFakeTimers()
    server = createMockServer()
    const { RED, registeredTypes } = createRED({ 'server-id': server })
    registerDimmerSwitch(RED)
    node = {}
    registeredTypes['signalk-dimmer-switch'].call(node, {
      id: 'n1',
      server: 'server-id',
      path: 'electrical.lights.cabin',
      displayName: 'Cabin Light',
      includeState: false
    })
  })

  afterEach(() => {
    node._trigger('close')
    clock.restore()
  })

  it('registers a PUT handler for the dimmingLevel path', () => {
    assert.equal(server.registerPutHandler.callCount, 1)
    const [, path] = server.registerPutHandler.getCall(0).args
    assert.equal(path, 'electrical.lights.cabin.dimmingLevel')
  })

  it('PUT handler accepts a value in [0, 1] and sends COMPLETED/200 via sendPutResponse', () => {
    const handler = server.registerPutHandler.getCall(0).args[2]

    const result = handler(
      'vessels.self',
      'electrical.lights.cabin.dimmingLevel',
      0.5,
      'cb'
    )

    assert.equal(result.state, 'PENDING')
    assert.equal(result.statusCode, 202)
    assert.equal(server.sendPutResponse.callCount, 1)
    const [, cbInfo, resp] = server.sendPutResponse.getCall(0).args
    assert.equal(cbInfo, 'cb')
    assert.equal(resp.state, 'COMPLETED')
    assert.equal(resp.statusCode, 200)
  })

  it('PUT handler rejects value outside [0, 1] with COMPLETED/400 via sendPutResponse', () => {
    const handler = server.registerPutHandler.getCall(0).args[2]

    handler('vessels.self', 'electrical.lights.cabin.dimmingLevel', 1.5, 'cb')

    assert.equal(server.sendPutResponse.callCount, 1)
    const [, , resp] = server.sendPutResponse.getCall(0).args
    assert.equal(resp.state, 'COMPLETED')
    assert.equal(resp.statusCode, 400)
    assert.equal(node.error.callCount, 1)
  })

  it('input handler accepts numeric dimmingLevel in [0, 1]', () => {
    node._trigger('input', { payload: 0.75 })

    assert.equal(node.error.callCount, 0)
    assert.equal(node.send.callCount, 1)
    const [dimMsg] = node.send.getCall(0).args[0]
    assert.equal(dimMsg.payload, 0.75)
  })

  it('input handler rejects dimmingLevel outside [0, 1]', () => {
    node._trigger('input', { payload: 2.0 })

    // setDimmingLevel fires one error; the input fallthrough fires another
    assert(node.error.callCount >= 1)
    assert.equal(node.send.callCount, 0)
  })

  it('input handler accepts object with dimmingLevel', () => {
    node._trigger('input', { payload: { dimmingLevel: 0.3 } })

    assert.equal(node.error.callCount, 0)
    assert.equal(node.send.callCount, 1)
  })

  it('registers PUT handler for statePath when includeState is true', () => {
    const { RED, registeredTypes } = createRED({ 'server-id': server })
    registerDimmerSwitch(RED)
    const n = {}
    registeredTypes['signalk-dimmer-switch'].call(n, {
      id: 'n2',
      server: 'server-id',
      path: 'electrical.lights.cabin',
      includeState: true
    })

    // should have registered handlers for both dimmingLevel and state
    const paths = server.registerPutHandler.getCalls().map((c) => c.args[1])
    assert(paths.includes('electrical.lights.cabin.dimmingLevel'))
    assert(paths.includes('electrical.lights.cabin.state'))
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
