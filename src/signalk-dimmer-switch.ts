import { NodeAPI } from 'node-red'
import coreDebug from 'debug'
import { getServer } from './config-client.js'
const debug = coreDebug('node-red-contrib-signalk:signalk-dimmer-switch')
const storeName = 'skpersist'

export default function (RED: NodeAPI) {
  function SignalKDimmerSwitch(config) {
    RED.nodes.createNode(this, config)
    const node = this

    const server = getServer(RED, node)

    if (!server) {
      return
    }

    const globalContext = node.context().global
    const includeState = config.includeState === true

    function normalizeBasePath(path) {
      if (path.endsWith('.dimmingLevel')) {
        return path.slice(0, -'.dimmingLevel'.length)
      }
      if (path.endsWith('.state')) {
        return path.slice(0, -'.state'.length)
      }
      return path
    }

    const basePath = normalizeBasePath(config.path)
    const dimmingPath = `${basePath}.dimmingLevel`
    const statePath = `${basePath}.state`

    function parseDimmingLevel(value) {
      const numericValue = Number(value)
      if (
        !Number.isFinite(numericValue) ||
        numericValue < 0 ||
        numericValue > 1
      ) {
        return undefined
      }
      return numericValue
    }

    function parseState(value) {
      if (value === true || value === 1) {
        return true
      }
      if (value === false || value === 0) {
        return false
      }
      return undefined
    }

    function sendValue(path, value) {
      const delta = {
        updates: [
          {
            values: [
              {
                value,
                path
              }
            ]
          }
        ]
      }
      server.handleMessage(node, delta)
    }

    function publishMeta(path, displayName, units?) {
      if (!displayName || displayName.length === 0) {
        return
      }

      const delta = {
        updates: [
          {
            meta: [
              {
                value: { displayName, units },
                path
              }
            ]
          }
        ]
      }
      server.handleMessage(node, delta)
    }

    function updateStatus(dimmingLevel, state?) {
      const stateText = includeState ? `, state: ${state}` : ''
      node.status({
        fill: 'green',
        shape: 'dot',
        text: `dimmingLevel: ${dimmingLevel}${stateText}`
      })
    }

    function statusTextForPendingPut(path, value) {
      if (path === dimmingPath) {
        return `pending dimmingLevel ${value}`
      }

      return `pending state ${value}`
    }

    function sendOutput(dimmingLevel, state, cbInfo) {
      let dimmingObj = null
      let stateObj = null
      let object: any = { topic: basePath, payload: {} }

      if (state !== null) {
        stateObj = {
          topic: statePath,
          payload: state,
          cbInfo
        }
        object.payload.state = state
      }

      if (dimmingLevel !== null) {
        dimmingObj = {
          topic: dimmingPath,
          payload: dimmingLevel,
          cbInfo
        }
        object.payload.dimmingLevel = dimmingLevel
      }

      if (Object.keys(object.payload).length > 0) {
        object.cbInfo = cbInfo
      } else {
        object = null
      }

      node.send([dimmingObj, stateObj, object])
    }

    function setState(value) {
      const state = parseState(value)
      if (state === undefined) {
        node.error(`invalid state: ${value}`)
        node.status({
          fill: 'red',
          shape: 'dot',
          text: `invalid state: ${value}`
        })
        return {
          state: 'COMPLETED',
          statusCode: 400,
          message: 'Invalid state'
        }
      }

      globalContext.set(statePath, state, storeName)
      sendValue(statePath, state)

      return { state: 'COMPLETED', statusCode: 200 }
    }

    function setDimmingLevel(value, _source) {
      const dimmingLevel = parseDimmingLevel(value)
      if (dimmingLevel === undefined) {
        node.error(`invalid dimmingLevel: ${value}`)
        node.status({
          fill: 'red',
          shape: 'dot',
          text: `invalid dimmingLevel: ${value}`
        })
        return {
          state: 'COMPLETED',
          statusCode: 400,
          message: 'Invalid dimmingLevel'
        }
      }

      globalContext.set(dimmingPath, dimmingLevel, storeName)
      sendValue(dimmingPath, dimmingLevel)

      if (includeState) {
        const state = dimmingLevel > 0
        globalContext.set(statePath, state, storeName)
        sendValue(statePath, state)
      }

      return { state: 'COMPLETED', statusCode: 200 }
    }

    server.registerPutHandler(
      node,
      dimmingPath,
      (context, path, value, cbInfo) => {
        const res = setDimmingLevel(value, 'put')
        if (res.statusCode === 200) {
          if (config.pending) {
            sendOutput(value, null, cbInfo)
            node.status({
              fill: 'green',
              shape: 'dot',
              text: statusTextForPendingPut(path, value)
            })
            return { state: 'PENDING', statusCode: 202 }
          }

          sendOutput(value, null, null)
        }
        return res
      }
    )

    if (includeState) {
      server.registerPutHandler(
        node,
        statePath,
        (context, path, value, cbInfo) => {
          const res = setState(value)
          if (res.statusCode === 200) {
            if (config.pending) {
              sendOutput(null, value, cbInfo)
              node.status({
                fill: 'green',
                shape: 'dot',
                text: statusTextForPendingPut(path, value)
              })
              return { state: 'PENDING', statusCode: 202 }
            }

            sendOutput(null, value, null)
          }
          return res
        }
      )
    }

    const onAvailable = () => {
      publishMeta(dimmingPath, config.displayName, 'ratio')
      if (includeState) {
        publishMeta(statePath, config.displayName)
      }

      globalContext.get(dimmingPath, storeName, (err, dimmingLevel) => {
        const initialDimming = dimmingLevel !== undefined ? dimmingLevel : 0
        globalContext.set(dimmingPath, initialDimming, storeName)
        sendValue(dimmingPath, initialDimming)

        if (includeState) {
          globalContext.get(statePath, storeName, (stateErr, state) => {
            const initialState =
              state !== undefined ? state : initialDimming > 0
            globalContext.set(statePath, initialState, storeName)
            sendValue(statePath, initialState)
          })
        }
      })
    }
    server.on('available', onAvailable)

    const resendInterval = setInterval(() => {
      globalContext.get(dimmingPath, storeName, (err, dimmingLevel) => {
        const resolvedDimming = dimmingLevel !== undefined ? dimmingLevel : 0
        sendValue(dimmingPath, resolvedDimming)

        if (includeState) {
          globalContext.get(statePath, storeName, (stateErr, state) => {
            const resolvedState = state !== undefined ? state : false
            sendValue(statePath, resolvedState)
            updateStatus(resolvedDimming, resolvedState)
          })
        } else {
          updateStatus(resolvedDimming)
        }
      })
    }, 5000)

    node.on('input', (msg) => {
      if (typeof msg.payload === 'number' || typeof msg.payload === 'string') {
        const result = setDimmingLevel(msg.payload, 'input')
        if (result.statusCode === 200) {
          sendOutput(msg.payload, null, null)
          return
        }
      } else if (includeState && typeof msg.payload === 'boolean') {
        const stateResult = setState(msg.payload)
        if (stateResult.statusCode === 200) {
          sendOutput(null, msg.payload, null)
          return
        }
      } else if (typeof msg.payload === 'object') {
        let changed = false

        if (msg.payload.dimmingLevel !== undefined) {
          const dimResult = setDimmingLevel(msg.payload.dimmingLevel, 'input')
          if (dimResult.statusCode !== 200) {
            return
          }
          changed = true
        }

        if (includeState && msg.payload.state !== undefined) {
          const stateResult = setState(msg.payload.state)
          if (stateResult.statusCode !== 200) {
            return
          }
          changed = true
        }

        if (changed) {
          sendOutput(
            msg.payload.dimmingLevel,
            includeState && msg.payload.state !== undefined
              ? msg.payload.state
              : null,
            null
          )
          return
        }
      }

      node.error(
        'payload must be a dimmingLevel between 0 and 1, a boolean, or an object with dimmingLevel and optional state'
      )
      node.status({ fill: 'red', shape: 'dot', text: 'invalid input' })
    })

    node.on('close', function () {
      clearInterval(resendInterval)
      server.removeListener('available', onAvailable)
      server.unRegisterPutHandler(node, dimmingPath)
      if (includeState) {
        server.unRegisterPutHandler(node, statePath)
      }
    })
  }

  RED.nodes.registerType('signalk-dimmer-switch', SignalKDimmerSwitch)
}
