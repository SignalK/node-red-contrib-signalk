import { NodeAPI, NodeContext } from 'node-red'
import coreDebug from 'debug'
import { getServer } from './config-client.js'
const debug = coreDebug('node-red-contrib-signalk:signalk-multi-switch')

const storeName = 'skpersist'

export default function (RED: NodeAPI) {
  function SignalKMultiSwitch(config) {
    RED.nodes.createNode(this, config)
    const node = this

    function getOptionWithValue(value) {
      return config.options.find((opt) => opt.value == value)
    }

    function setStatusWithValue(value) {
      const option = getOptionWithValue(value)
      node.status({
        fill: 'green',
        shape: 'dot',
        text: `value: ${option ? option.title : value}`
      })
    }

    const server = getServer(RED, node)

    if (!server) {
      return
    }
    const globalContext: NodeContext = node.context().global

    if (config.options.length === 0) {
      node.error('at least one option must be defined')
      node.status({
        fill: 'red',
        shape: 'dot',
        text: 'at least one option must be defined'
      })
      return
    } else {
      node.status({})
    }

    let path = config.path
    if (!path.endsWith('.state')) {
      path += '.state'
    }

    function handlePut(context, path, value, cbInfo) {
      const option = getOptionWithValue(value)
      if (!option) {
        node.error(`invalid value: ${value}`)
        node.status({
          fill: 'red',
          shape: 'dot',
          text: `invalid value: ${value}`
        })

        return {
          state: 'COMPLETED',
          statusCode: 400,
          message: 'Invalid value'
        }
      } else {
        globalContext.set(path, option.value, storeName, (err) => {
          if (err) {
            node.error(`error setting value: ${err}`)
            node.status({
              fill: 'red',
              shape: 'dot',
              text: `error setting value: ${err}`
            })
            server.sendPutResponse(node, cbInfo, {
              state: 'COMPLETED',
              statusCode: 500,
              message: err.toString()
            })
            return
          }
          sendUpdate(option.value)
          if (config.pending) {
            node.send({ topic: path, payload: option.value, cbInfo })
            node.status({
              fill: 'green',
              shape: 'dot',
              text: `pending value ${option.title}`
            })
          } else {
            node.send({ topic: path, payload: option.value })
            node.status({
              fill: 'green',
              shape: 'dot',
              text: `put received: ${option.title}`
            })
            server.sendPutResponse(node, cbInfo, {
              state: 'COMPLETED',
              statusCode: 200
            })
          }
        })
      }

      return {
        state: 'PENDING',
        statusCode: 202
      }
    }

    function sendUpdate(value) {
      const delta = {
        updates: [
          {
            values: [
              {
                value,
                path: path
              }
            ]
          }
        ]
      }
      server.handleMessage(node, delta)
    }

    let resendInterval

    const onConnect = () => {
      globalContext.get(path, storeName, (err, value) => {
        const possibleValues = config.options

        const delta = {
          updates: [
            {
              meta: [
                {
                  value: {
                    displayName: config.displayName,
                    possibleValues: possibleValues,
                    type: 'multiple',
                    supportsPut: true
                  },
                  path: path
                }
              ]
            }
          ]
        }
        server.handleMessage(node, delta)

        sendUpdate(value !== undefined ? value : config.options[0].value)
        resendInterval = setInterval(() => {
          globalContext.get(path, storeName, (err, value) => {
            value = value !== undefined ? value : config.options[0].value
            sendUpdate(value)
            setStatusWithValue(value)
          })
        }, 5000)
      })
    }
    server.on('available', onConnect)

    server.registerPutHandler(node, path, handlePut)

    node.on('input', (msg) => {
      const option = getOptionWithValue(msg.payload)
      if (option) {
        globalContext.set(path, option.value, storeName, (err) => {
          sendUpdate(option.value)
          node.status({
            fill: 'green',
            shape: 'dot',
            text: `input: ${option.title}`
          })
          node.send({ topic: path, payload: option.value })
        })
      } else {
        node.error(
          `payload must be one of: ${config.options.map((opt) => opt.value).join(', ')}`
        )
        node.status({ fill: 'red', shape: 'dot', text: `invalid input` })
      }
    })

    node.on('close', function () {
      server.unRegisterPutHandler(node, path)
      server.removeListener('available', onConnect)
      if (resendInterval) {
        clearInterval(resendInterval)
      }
    })
  }
  RED.nodes.registerType('signalk-multi-switch', SignalKMultiSwitch)
}
