import assert from 'node:assert/strict'
import { createRED, createMockServer } from './helpers/red-mock.js'
import registerGet from '../dist/signalk-get.js'

describe('signalk-get', () => {
  let server, node

  beforeEach(() => {
    server = createMockServer()
    const { RED, registeredTypes } = createRED({ 'server-id': server })
    registerGet(RED)
    node = {}
    registeredTypes['signalk-get'].call(node, {
      id: 'n1',
      server: 'server-id',
      path: 'navigation.speedOverGround'
    })
  })

  it('calls server.getSelfPath with the configured path', async () => {
    server.getSelfPath.resolves({ value: 3.5 })
    node._trigger('input', {})
    await Promise.resolve()

    assert.equal(server.getSelfPath.callCount, 1)
    assert.equal(
      server.getSelfPath.getCall(0).args[0],
      'navigation.speedOverGround'
    )
  })

  it('falls back to msg.topic when config.path is empty', async () => {
    const { RED, registeredTypes } = createRED({ 'server-id': server })
    registerGet(RED)
    const n = {}
    registeredTypes['signalk-get'].call(n, {
      id: 'n2',
      server: 'server-id',
      path: ''
    })

    server.getSelfPath.resolves({ value: 1.5 })
    n._trigger('input', { topic: 'navigation.courseOverGroundTrue' })
    await Promise.resolve()

    assert.equal(
      server.getSelfPath.getCall(0).args[0],
      'navigation.courseOverGroundTrue'
    )
  })

  it('sends value on port 0 when path is found', async () => {
    server.getSelfPath.resolves({ value: 7.2 })

    node._trigger('input', {})
    await Promise.resolve()

    assert.equal(node.send.callCount, 1)
    const [port0, port1] = node.send.getCall(0).args[0]
    assert(port0 !== null)
    assert.equal(port0.payload, 7.2)
    assert.equal(port1, null)
  })

  it("sends 'not found' on port 1 when getSelfPath returns null", async () => {
    server.getSelfPath.resolves(null)

    node._trigger('input', {})
    await Promise.resolve()

    const [port0, port1] = node.send.getCall(0).args[0]
    assert.equal(port0, null)
    assert(port1 !== null)
    assert.equal(port1.payload, 'not found')
  })

  it("sends 'not found' on port 1 when value is null", async () => {
    server.getSelfPath.resolves({ value: null })

    node._trigger('input', {})
    await Promise.resolve()

    const [port0, port1] = node.send.getCall(0).args[0]
    assert.equal(port0, null)
    assert(port1 !== null)
  })
})
