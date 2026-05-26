import sinon from 'sinon'

/**
 * Creates a context store that supports both direct property access
 * (context[key]) and the Node-RED context API (context.get/set/global/flow).
 * Pass initialGlobal to pre-populate the global context (e.g. { app, lodash }).
 */
export function createNodeContext(initialGlobal = {}) {
  const globalData = { ...initialGlobal }
  const globalContext = {
    get(key, storeOrCb, cb) {
      const val = globalData[key]
      if (typeof storeOrCb === 'function') {
        storeOrCb(null, val)
      } else if (typeof cb === 'function') {
        cb(null, val)
      } else {
        return val
      }
    },
    set(key, value, _storeName) {
      globalData[key] = value
    },
    _data: globalData
  }

  const flowData = {}
  const flowContext = {
    get(key) {
      return flowData[key]
    },
    set(key, value) {
      flowData[key] = value
    }
  }

  const context = {}
  context.get = (key, storeOrCb, cb) => {
    const val = context[key]
    if (typeof storeOrCb === 'function') {
      storeOrCb(null, val)
    } else if (typeof cb === 'function') {
      cb(null, val)
    } else {
      return val
    }
  }
  context.set = (key, value) => {
    context[key] = value
  }
  context.global = globalContext
  context.flow = flowContext

  return context
}

/**
 * Creates a mock Signal K server (config-client node).
 */
export function createMockServer(overrides = {}) {
  const listeners = {}
  const server = {
    self: 'vessels.urn:mrn:imo:mmsi:123456789',
    subscribe: sinon.stub(),
    putSelfPath: sinon.stub(),
    getSelfPath: sinon.stub().resolves(null),
    handleMessage: sinon.stub().resolves(true),
    registerPutHandler: sinon.stub(),
    unRegisterPutHandler: sinon.stub(),
    sendPutResponse: sinon.stub(),
    onError(node, err) {
      node.error(err.message !== undefined ? err.message : err)
    },
    on(event, handler) {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(handler)
    },
    removeListener(event, handler) {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((h) => h !== handler)
      }
    },
    emit(event, ...args) {
      ;(listeners[event] || []).forEach((h) => h(...args))
    },
    ...overrides
  }
  return server
}

/**
 * Creates a minimal mock app object for embedded nodes.
 * Supports EventEmitter-style on/removeListener/emit plus sinon stubs.
 */
export function createMockApp(overrides = {}) {
  const listeners = {}
  return {
    selfContext: 'vessels.urn:mrn:imo:mmsi:123456789',
    on(event, handler) {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(handler)
    },
    removeListener(event, handler) {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((h) => h !== handler)
      }
    },
    emit: sinon.stub().callsFake((event, ...args) => {
      ;(listeners[event] || []).forEach((h) => h(...args))
    }),
    handleMessage: sinon.stub(),
    ...overrides
  }
}

/**
 * Creates a minimal mock SignalK event emitter for embedded delta nodes.
 */
export function createMockSignalK() {
  const listeners = {}
  return {
    on(event, handler) {
      if (!listeners[event]) listeners[event] = []
      listeners[event].push(handler)
    },
    removeListener(event, handler) {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter((h) => h !== handler)
      }
    },
    emit(event, ...args) {
      ;(listeners[event] || []).forEach((h) => h(...args))
    }
  }
}

/**
 * Creates a mock RED object for use in Node-RED node tests.
 *
 * @param {Object} registeredNodes  map of nodeId → mock node (for getNode())
 * @param {Object} options
 * @param {Object} options.globalContext  initial global context data (e.g. { app, lodash })
 */
export function createRED(registeredNodes = {}, options = {}) {
  const registeredTypes = {}
  const globalData = options.globalContext || {}

  const RED = {
    nodes: {
      createNode(node, config) {
        node.id = config.id || 'test-node-id'
        node.name = config.name || ''
        if (config.server !== undefined) node.server = config.server

        const context = createNodeContext(globalData)
        node.context = () => context

        const eventHandlers = {}
        node.on = (event, handler) => {
          if (!eventHandlers[event]) eventHandlers[event] = []
          eventHandlers[event].push(handler)
        }
        node._trigger = (event, ...args) => {
          ;(eventHandlers[event] || []).forEach((h) => h(...args))
        }

        node.send = sinon.stub()
        node.status = sinon.stub()
        node.log = sinon.stub()
        node.warn = sinon.stub()
        node.error = sinon.stub()
      },
      registerType(name, constructor) {
        registeredTypes[name] = constructor
      },
      getNode(id) {
        return registeredNodes[id] || null
      }
    }
  }

  return { RED, registeredTypes }
}

/** Convenience: register a node module and instantiate a node in one call. */
export function buildNode(
  registerFn,
  typeName,
  config,
  serverNodes = {},
  options = {}
) {
  const { RED, registeredTypes } = createRED(serverNodes, options)
  registerFn(RED)
  const node = {}
  registeredTypes[typeName].call(node, config)
  return { node, RED, registeredTypes }
}
