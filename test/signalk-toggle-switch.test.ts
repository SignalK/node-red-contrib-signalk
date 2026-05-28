import assert from 'node:assert/strict'
import sinon from 'sinon'
import { createRED, createMockServer } from './helpers/red-mock.js'
import registerToggleSwitch from '../dist/signalk-toggle-switch.js'

describe('signalk-toggle-switch', () => {
  let server, node, clock

  beforeEach(() => {
    clock = sinon.useFakeTimers()
    server = createMockServer()
    const { RED, registeredTypes } = createRED({ 'server-id': server })
    registerToggleSwitch(RED)
    node = {}
    registeredTypes['signalk-toggle-switch'].call(node, {
      id: 'n1',
      server: 'server-id',
      path: 'electrical.switches.0',
      displayName: 'Test Switch'
    })
  })

  afterEach(() => {
    node._trigger('close')
    clock.restore()
  })

  it('appends .state to path when not already present', () => {
    server.emit('available')

    // The handleMessage delta should use the .state path
    assert(server.handleMessage.callCount >= 1)
    const delta = server.handleMessage.getCall(0).args[1]
    const path = delta.updates[0].meta[0].path
    assert.equal(path, 'electrical.switches.0.state')
  })

  it('registers a PUT handler for the .state path', () => {
    assert.equal(server.registerPutHandler.callCount, 1)
    const [, path] = server.registerPutHandler.getCall(0).args
    assert.equal(path, 'electrical.switches.0.state')
  })

  it('PUT handler sends boolean value and returns COMPLETED/200 by default', () => {
    const handler = server.registerPutHandler.getCall(0).args[2]

    const result = handler(
      'vessels.self',
      'electrical.switches.0.state',
      true,
      'cb-id'
    )

    assert.equal(result.state, 'COMPLETED')
    assert.equal(result.statusCode, 200)
    assert.equal(node.send.callCount, 1)
    assert.equal(node.send.getCall(0).args[0].payload, true)
  })

  it('PUT handler coerces numeric 1 to true', () => {
    const handler = server.registerPutHandler.getCall(0).args[2]

    handler('vessels.self', 'electrical.switches.0.state', 1, 'cb-id')

    assert.equal(node.send.getCall(0).args[0].payload, true)
  })

  it('PUT handler returns PENDING/202 when config.pending is true', () => {
    const { RED: r2, registeredTypes: rt2 } = createRED({
      'server-id': server
    })
    registerToggleSwitch(r2)
    const pendingNode = {}
    rt2['signalk-toggle-switch'].call(pendingNode, {
      id: 'n2',
      server: 'server-id',
      path: 'electrical.switches.1',
      pending: true
    })
    // server.registerPutHandler was called twice now; take the last one
    const handler = server.registerPutHandler.lastCall.args[2]

    const result = handler(
      'vessels.self',
      'electrical.switches.1.state',
      false,
      'cb-id'
    )

    assert.equal(result.state, 'PENDING')
    assert.equal(result.statusCode, 202)
    assert.equal(pendingNode.send.getCall(0).args[0].cbInfo, 'cb-id')
    pendingNode._trigger('close')
  })

  it('input handler sends boolean payload and updates Signal K', () => {
    node._trigger('input', { payload: true })

    assert.equal(node.send.callCount, 1)
    assert.equal(node.send.getCall(0).args[0].payload, true)
    assert(server.handleMessage.called)
  })

  it('input handler rejects non-boolean payload', () => {
    node._trigger('input', { payload: 'yes' })

    assert.equal(node.send.callCount, 0)
    assert.equal(node.error.callCount, 1)
  })

  it('sends update delta with current value on available', () => {
    server.emit('available')

    // First handleMessage sends meta, second sends the value delta
    const calls = server.handleMessage.getCalls()
    const valueDelta = calls.find((c) => c.args[1].updates[0].values)
    assert(valueDelta, 'expected a value delta to be sent')
    assert.equal(
      valueDelta.args[1].updates[0].values[0].path,
      'electrical.switches.0.state'
    )
  })

  it('clears resend interval and unregisters handler on close', () => {
    server.emit('available')
    node._trigger('close')

    assert.equal(server.unRegisterPutHandler.callCount, 1)
    // After close, ticking time should not trigger more handleMessage calls
    const countBefore = server.handleMessage.callCount
    clock.tick(10000)
    assert.equal(server.handleMessage.callCount, countBefore)
  })
})
