import assert from 'node:assert/strict'
import { createRED, createMockServer } from './helpers/red-mock.js'
import registerSendPut from '../signalk-send-put.js'

describe('signalk-send-put', () => {
  let server, node

  beforeEach(() => {
    server = createMockServer()
    const { RED, registeredTypes } = createRED({ 'server-id': server })
    registerSendPut(RED)
    node = {}
    registeredTypes['signalk-send-put'].call(node, {
      id: 'n1',
      server: 'server-id',
      path: 'electrical.switches.0.state'
    })
  })

  it('calls server.putSelfPath with the configured path and message payload', () => {
    node._trigger('input', { payload: true })

    assert.equal(server.putSelfPath.callCount, 1)
    const [, path, value] = server.putSelfPath.getCall(0).args
    assert.equal(path, 'electrical.switches.0.state')
    assert.equal(value, true)
  })

  it('falls back to msg.topic when no path is configured', () => {
    const { RED, registeredTypes } = createRED({ 'server-id': server })
    registerSendPut(RED)
    const n = {}
    registeredTypes['signalk-send-put'].call(n, {
      id: 'n2',
      server: 'server-id',
      path: ''
    })

    n._trigger('input', { topic: 'navigation.speedOverGround', payload: 5.0 })

    const [, path] = server.putSelfPath.getCall(0).args
    assert.equal(path, 'navigation.speedOverGround')
  })

  it('sends success reply on port 0 when PUT completes with 200', () => {
    node._trigger('input', { payload: true })

    const callback = server.putSelfPath.getCall(0).args[3]
    callback({ state: 'COMPLETED', statusCode: 200 })

    assert.equal(node.send.callCount, 1)
    const [port0, port1] = node.send.getCall(0).args[0]
    assert(port0 !== null, 'port 0 should have a message')
    assert.equal(port1, null)
    assert.equal(port0.payload.statusCode, 200)
  })

  it('sends error reply on port 1 when PUT completes with non-200 status', () => {
    node._trigger('input', { payload: true })

    const callback = server.putSelfPath.getCall(0).args[3]
    callback({ state: 'COMPLETED', statusCode: 403, message: 'Forbidden' })

    assert.equal(node.send.callCount, 1)
    const [port0, port1] = node.send.getCall(0).args[0]
    assert.equal(port0, null)
    assert(port1 !== null, 'port 1 should have a message')
    assert.equal(port1.payload.statusCode, 403)
  })

  it('does not send while PUT is in PENDING state', () => {
    node._trigger('input', { payload: true })

    const callback = server.putSelfPath.getCall(0).args[3]
    callback({ state: 'PENDING' })

    assert.equal(node.send.callCount, 0)
  })

  it('passes config.source to putSelfPath when configured', () => {
    const { RED, registeredTypes } = createRED({ 'server-id': server })
    registerSendPut(RED)
    const n = {}
    registeredTypes['signalk-send-put'].call(n, {
      id: 'n3',
      server: 'server-id',
      path: 'some.path',
      source: 'my-source'
    })

    n._trigger('input', { payload: 1 })

    const source = server.putSelfPath.getCall(0).args[4]
    assert.equal(source, 'my-source')
  })
})
