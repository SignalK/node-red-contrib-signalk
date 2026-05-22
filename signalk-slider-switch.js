import coreDebug from 'debug'
const debug = coreDebug('node-red-contrib-signalk:signalk-slider-switch')

const storeName = 'skpersist'

export default function(RED) {
  function SignalKSliderSwitch(config) {
    RED.nodes.createNode(this, config)
    const node = this

    const server = RED.nodes.getNode(config.server)
    const globalContext = node.context().global

    const rangeMin = Number(config.rangeMin)
    const rangeMax = Number(config.rangeMax)
    const stepSize = config.stepSize !== '' && config.stepSize !== undefined
      ? Number(config.stepSize)
      : undefined
    const units = config.units && config.units.length > 0
      ? config.units
      : undefined

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
            values: [
              { value, path }
            ]
          }
        ]
      }
      server.handleMessage(node, delta)
    }

    function publishMeta() {
      const metaValue = {
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
            meta: [
              { value: metaValue, path }
            ]
          }
        ]
      }
      server.handleMessage(node, delta)
    }

    function handleValue(context, path, value) {
      const parsed = parseValue(value)
      let resp
      if (parsed === undefined) {
        node.error(`invalid value: ${value} (must be a number between ${rangeMin} and ${rangeMax})`)
        node.status({ fill: 'red', shape: 'dot', text: `invalid value: ${value}` })
        resp = {
          state: "COMPLETED",
          statusCode:400, 
          message: 'Invalid value'
        }
      } else {
        globalContext.set(path, parsed, storeName)
        sendValue(parsed)
        node.send({ topic: path, payload: parsed })
        node.status({ fill: 'green', shape: 'dot', text: `value: ${parsed}` })
        resp = {
          state: "COMPLETED",
          statusCode: 200
        }
      }
      return resp
    }

    server.registerPutHandler(node, path, handleValue)

    let resendInterval

    const onConnect = () => {
      publishMeta()

      globalContext.get(path, storeName, (err, value) => {
        const initial = value !== undefined ? value : rangeMin
        globalContext.set(path, initial, storeName)
        node.status({ fill: 'green', shape: 'dot', text: `value: ${initial}` })
      })

      resendInterval = setInterval(() => {
        globalContext.get(path, storeName, (err, value) => {
          const resolved = value !== undefined ? value : rangeMin
          sendValue(resolved)
          node.status({ fill: 'green', shape: 'dot', text: `value: ${resolved}` })
        })
      }, 5000)
    }
    server.client.on('authenticated', onConnect)

    node.on('input', msg => {
      handleValue(null, path, msg.payload)
    })

    node.on('close', function() {
      clearInterval(resendInterval)
      server.client.removeListener('authenticated', onConnect)
      server.unRegisterPutHandler(node, path)
    })
  }

  RED.nodes.registerType('signalk-slider-switch', SignalKSliderSwitch)
}
