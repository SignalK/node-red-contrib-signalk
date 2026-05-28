import assert from 'node:assert/strict'
import { createRED, createMockServer } from './helpers/red-mock.js'
import registerPutHandler from '../signalk-put-handler.js'

describe('signalk-put-handler', () => {
  let server, node

  function setup(config = {}) {
    server = createMockServer()
    const { RED, registeredTypes } = createRED({ 'server-id': server })
    registerPutHandler(RED)
    node = {}
    registeredTypes['signalk-put-handler'].call(node, {
      id: 'n1',
      server: 'server-id',
      path: 'electrical.switches.0.state',
      ...config
    })
    return node
  }

  it('registers a PUT handler for the configured path on init', () => {
    setup()
    assert.equal(server.registerPutHandler.callCount, 1)
    const [, path] = server.registerPutHandler.getCall(0).args
    assert.equal(path, 'electrical.switches.0.state')
  })

  it('sends a message with topic and payload when PUT is received', () => {
    setup()
    const handler = server.registerPutHandler.getCall(0).args[2]

    handler('vessels.self', 'electrical.switches.0.state', true, 'cb-id')

    assert.equal(node.send.callCount, 1)
    const msg = node.send.getCall(0).args[0]
    assert.equal(msg.topic, 'electrical.switches.0.state')
    assert.equal(msg.payload, true)
  })

  it('returns COMPLETED/200 when config.pending is false', () => {
    setup({ pending: false })
    const handler = server.registerPutHandler.getCall(0).args[2]

    const result = handler(
      'vessels.self',
      'electrical.switches.0.state',
      true,
      'cb-id'
    )

    assert.equal(result.state, 'COMPLETED')
    assert.equal(result.statusCode, 200)
  })

  it('returns PENDING/202 and includes cbInfo in message when config.pending is true', () => {
    setup({ pending: true })
    const handler = server.registerPutHandler.getCall(0).args[2]

    const result = handler(
      'vessels.self',
      'electrical.switches.0.state',
      true,
      'cb-id'
    )

    assert.equal(result.state, 'PENDING')
    assert.equal(result.statusCode, 202)
    const msg = node.send.getCall(0).args[0]
    assert.equal(msg.cbInfo, 'cb-id')
  })

  it('sends meta with supportsPut:true when available fires', () => {
    setup()
    server.emit('available')

    assert.equal(server.handleMessage.callCount, 1)
    const [, delta] = server.handleMessage.getCall(0).args
    const meta = delta.updates[0].meta[0]
    assert.equal(meta.value.supportsPut, true)
    assert.equal(meta.path, 'electrical.switches.0.state')
  })

  it('unregisters PUT handler on close', () => {
    setup()
    node._trigger('close')

    assert.equal(server.unRegisterPutHandler.callCount, 1)
    const [, path] = server.unRegisterPutHandler.getCall(0).args
    assert.equal(path, 'electrical.switches.0.state')
  })
})
