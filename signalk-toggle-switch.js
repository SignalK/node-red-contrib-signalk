
import coreDebug from 'debug'
const debug = coreDebug('node-red-contrib-signalk:signalk-toggle-switch')
const storeName = 'skpersist'

export default function(RED) {
  function SignalKToggleSwitch(config) {
    RED.nodes.createNode(this,config);
    const node = this;

    const server = RED.nodes.getNode(config.server)
    const globalContext = node.context().global

    let path = config.path
    if ( !path.endsWith('.state') ) {
      path += '.state'
    }

    function handlePut(context, path, value, requestId) {
      value = value === 1 || value === true
      globalContext.set(path, value, storeName)
      sendUpdate(value)
      node.send({ topic: path, payload: value })
      node.status({ fill: "green", shape: "dot", text: `put received: ${value}` });

      return {
        requestId: requestId,
        state: "COMPLETED",
        statusCode: 200
      }
    }

    function sendUpdate(value) {
      let delta = {
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
      //debug('sending delta %j', delta)
      server.handleMessage(node, delta)
    }

    let resendInterval

    const onConnect = () => {
      globalContext.get(path, storeName, (err, value) => {
        if ( err ) {
          node.error('error retrieving value from context store', err)
          node.status({ fill: "red", shape: "dot", text: 'error retrieving value from context store' });
          return
        }
        let delta = {
          updates: [
            {
              meta: [
                {
                  value: { 
                    displayName: config.displayName,
                    supportsPut: true
                  },
                  path: path
                }
              ]
            }
          ]
        }
        debug('sending meta %j', delta)
        server.handleMessage(node, delta)

        sendUpdate(value !== undefined ? value : false)
        resendInterval = setInterval(() => {
          globalContext.get(path, storeName, (err, value) => {
            sendUpdate(value !== undefined ? value : false)
          })
        }, 5000)
      })
    }

    server.client.on('authenticated', onConnect)

    server.registerPutHandler(node, path, handlePut)

    node.on('input', msg => {
      if ( typeof msg.payload === 'boolean' ) {
        globalContext.set(path, msg.payload, storeName)
        sendUpdate(msg.payload)
        node.status({fill:"green",shape:"dot",text:`input: ${msg.payload}`});
        node.send({topic: path, payload: msg.payload})
      } else {
        node.error('payload must be boolean')
        node.status({fill:"red",shape:"dot",text:`invalid input`});
      }
    })
    
    node.on('close', function() {
      server.unRegisterPutHandler(node, path)
      server.client.removeListener('authenticated', onConnect)
      if (resendInterval) {
        clearInterval(resendInterval)
      }
    })
  }
  RED.nodes.registerType("signalk-toggle-switch", SignalKToggleSwitch);
}
