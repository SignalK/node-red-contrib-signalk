import assert from 'node:assert/strict'
import { createRED, createMockServer } from './helpers/red-mock.js'
import registerNotification from '../dist/signalk-notification.js'

describe('signalk-notification', () => {
  let server, RED, registeredTypes

  beforeEach(() => {
    server = createMockServer()
    ;({ RED, registeredTypes } = createRED({ 'server-id': server }))
    registerNotification(RED)
  })

  function makeNode(config) {
    const node = {}
    registeredTypes['signalk-notification'].call(node, {
      id: 'n1',
      server: 'server-id',
      ...config
    })
    return node
  }

  function makeDelta(path, state) {
    return {
      updates: [
        {
          values: [{ path, value: { state, message: 'test' } }]
        }
      ]
    }
  }

  it('subscribes to the configured notification path on available', () => {
    makeNode({ notification: 'notifications.my.alarm', state: 'any' })
    server.emit('available')

    assert.equal(server.subscribe.callCount, 1)
    const [ctx, path] = server.subscribe.getCall(0).args
    assert.equal(ctx, 'vessels.self')
    assert.equal(path, 'notifications.my.alarm')
  })

  it("subscribes to notifications.* when notification is 'any'", () => {
    makeNode({ notification: 'any', state: 'any' })
    server.emit('available')

    const [, path] = server.subscribe.getCall(0).args
    assert.equal(path, 'notifications.*')
  })

  it('subscribes to notifications.* when notification is empty string', () => {
    makeNode({ notification: '', state: 'any' })
    server.emit('available')

    const [, path] = server.subscribe.getCall(0).args
    assert.equal(path, 'notifications.*')
  })

  it('sends notification when state matches config.state', () => {
    const node = makeNode({
      notification: 'notifications.alarm',
      state: 'alarm'
    })
    server.emit('available')
    const onDelta = server.subscribe.getCall(0).args[4]

    onDelta(makeDelta('notifications.alarm', 'alarm'))

    assert.equal(node.send.callCount, 1)
    assert.equal(node.send.getCall(0).args[0].payload.value.state, 'alarm')
  })

  it('does not send when notification state does not match', () => {
    const node = makeNode({
      notification: 'notifications.alarm',
      state: 'alarm'
    })
    server.emit('available')
    const onDelta = server.subscribe.getCall(0).args[4]

    onDelta(makeDelta('notifications.alarm', 'normal'))

    assert.equal(node.send.callCount, 0)
  })

  it("sends notification for any state when config.state is 'any'", () => {
    const node = makeNode({
      notification: 'notifications.alarm',
      state: 'any'
    })
    server.emit('available')
    const onDelta = server.subscribe.getCall(0).args[4]

    for (const state of ['normal', 'alert', 'warn', 'alarm', 'emergency']) {
      onDelta(makeDelta('notifications.alarm', state))
    }

    assert.equal(node.send.callCount, 5)
  })
})
