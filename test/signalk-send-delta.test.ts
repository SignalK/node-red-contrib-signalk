import assert from 'node:assert/strict'
import { createRED, createMockServer } from './helpers/red-mock.js'
import registerSendDelta from '../signalk-send-delta.js'

describe('signalk-send-delta', () => {
  let server, node

  beforeEach(() => {
    server = createMockServer()
    const { RED, registeredTypes } = createRED({ 'server-id': server })
    registerSendDelta(RED)
    node = {}
    registeredTypes['signalk-send-delta'].call(node, {
      id: 'n1',
      server: 'server-id'
    })
  })

  it('calls server.handleMessage with msg.payload as the delta', async () => {
    const delta = {
      context: 'vessels.self',
      updates: [
        { values: [{ path: 'navigation.speedOverGround', value: 2.0 }] }
      ]
    }

    node._trigger('input', { payload: delta })

    // handleMessage is async; give the resolved promise a tick to run
    await Promise.resolve()

    assert.equal(server.handleMessage.callCount, 1)
    assert.deepEqual(server.handleMessage.getCall(0).args[1], delta)
  })

  it('shows sent status when handleMessage resolves true', async () => {
    server.handleMessage.resolves(true)

    node._trigger('input', { payload: {} })
    await Promise.resolve()

    assert(
      node.status.getCalls().some((c) => c.args[0].text === 'sent'),
      "expected 'sent' status"
    )
  })

  it('does not show sent status when handleMessage resolves false', async () => {
    server.handleMessage.resolves(false)

    node._trigger('input', { payload: {} })
    await Promise.resolve()

    assert(
      !node.status.getCalls().some((c) => c.args[0].text === 'sent'),
      "expected no 'sent' status"
    )
  })
})
