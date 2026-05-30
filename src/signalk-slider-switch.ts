import { NodeAPI } from 'node-red'
import coreDebug from 'debug'
import { getServer } from './config-client.js'
const debug = coreDebug('node-red-contrib-signalk:signalk-slider-switch')

const storeName = 'skpersist'

export default function (RED: NodeAPI) {
  function SignalKSliderSwitch(config: any) {
    RED.nodes.createNode(this, config)
    const node = this

    const server = getServer(RED, node)

    if (!server) {
      return
    }
    const globalContext = node.context().global

    const rangeMin = Number(config.rangeMin)
    const rangeMax = Number(config.rangeMax)
    const stepSize =
      config.stepSize !== '' && config.stepSize !== undefined
        ? Number(config.stepSize)
        : undefined
    const units =
      config.units && config.units.length > 0 ? config.units : undefined

    let path = config.path
    if (!path.endsWith('.state')) {
      path += '.state'
    }

    function parseValue(value) {
      const numericValue = Number(value)
      if (!Number.isFinite(numericValue)) {
        return undefined
      }
      if (numericValue < rangeMin || numericValue > rangeMax) {
        return undefined
      }
      return numericValue
    }

    function sendValue(value) {
      const delta = {
        updates: [
          {
            values: [{ value, path }]
          }
        ]
      }
      server.handleMessage(node, delta)
    }

    function publishMeta() {
      const metaValue: any = {
        rangeMin,
        rangeMax,
        supportsPut: true
      }

      if (stepSize !== undefined) {
        metaValue.stepSize = stepSize
      }

      if (config.displayName && config.displayName.length > 0) {
        metaValue.displayName = config.displayName
      }

      if (units !== undefined) {
        metaValue.units = units
      }

      const delta = {
        updates: [
          {
            meta: [{ value: metaValue, path }]
          }
        ]
      }
      server.handleMessage(node, delta)
    }

    function setValue(value, cb) {
      const parsed = parseValue(value)
      if (parsed === undefined) {
        node.error(
          `invalid value: ${value} (must be a number between ${rangeMin} and ${rangeMax})`
        )
        node.status({
          fill: 'red',
          shape: 'dot',
          text: `invalid value: ${value}`
        })
        cb({
          state: 'COMPLETED',
          statusCode: 400,
          message: 'Invalid value'
        })
        return
      }

      globalContext.set(path, parsed, storeName, (err) => {
        if (err) {
          node.error(`error setting value: ${err}`)
          node.status({
            fill: 'red',
            shape: 'dot',
            text: `error setting value: ${err}`
          })
          cb({
            state: 'COMPLETED',
            statusCode: 500,
            message: err.toString()
          })
          return
        }
        sendValue(parsed)
        cb({
          state: 'COMPLETED',
          statusCode: 200,
          value: parsed
        })
      })
    }

    function handlePut(context, path, value, cbInfo) {
      setValue(value, (res) => {
        if (res.statusCode !== 200) {
          server.sendPutResponse(node, cbInfo, res)
          return
        }

        if (config.pending) {
          node.send({ topic: path, payload: res.value, cbInfo })
          node.status({
            fill: 'green',
            shape: 'dot',
            text: `pending value ${res.value}`
          })
          return
        }

        node.send({ topic: path, payload: res.value })
        node.status({
          fill: 'green',
          shape: 'dot',
          text: `value: ${res.value}`
        })
        server.sendPutResponse(node, cbInfo, {
          state: 'COMPLETED',
          statusCode: 200
        })
      })
      return {
        state: 'PENDING',
        statusCode: 202
      }
    }

    server.registerPutHandler(node, path, handlePut)

    let resendInterval

    const onConnect = () => {
      publishMeta()

      globalContext.get(path, storeName, (err, value) => {
        const initial = value !== undefined ? value : rangeMin
        globalContext.set(path, initial, storeName, (setErr) => {
          if (setErr) {
            node.error(`error setting value: ${setErr}`)
            return
          }
          node.status({
            fill: 'green',
            shape: 'dot',
            text: `value: ${initial}`
          })
        })
      })

      resendInterval = setInterval(() => {
        globalContext.get(path, storeName, (err, value) => {
          const resolved = value !== undefined ? value : rangeMin
          sendValue(resolved)
          node.status({
            fill: 'green',
            shape: 'dot',
            text: `value: ${resolved}`
          })
        })
      }, 5000)
    }
    server.on('available', onConnect)

    node.on('input', (msg) => {
      setValue(msg.payload, (res) => {
        if (res.statusCode === 200) {
          node.send({ topic: path, payload: res.value })
          node.status({
            fill: 'green',
            shape: 'dot',
            text: `value: ${res.value}`
          })
        }
      })
    })

    node.on('close', function () {
      clearInterval(resendInterval)
      server.removeListener('available', onConnect)
      server.unRegisterPutHandler(node, path)
    })
  }

  RED.nodes.registerType('signalk-slider-switch', SignalKSliderSwitch)
}
