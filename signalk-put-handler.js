
import coreDebug from 'debug'
const debug = coreDebug('node-red-contrib-signalk:signalk-put-handler')

export default function(RED) {
  function SignalKOnDelta(config) {
    RED.nodes.createNode(this,config);
    var node = this;

    const server = RED.nodes.getNode(config.server)

    function handlePut(context, path, value, cbInfo) {
      if ( config.pending ) {
        node.send({topic: path, payload: value, cbInfo})
        return {
          "state": "PENDING",
          "statusCode": 202
        }
      } else {
        node.send({topic: path, payload: value})
        return {
          "state": "COMPLETED",
          "statusCode": 200
        }
      }
    }

    const onAvailable = () => {
      const meta = {
          updates: [
            {
              meta: [
                {
                  value: { supportsPut: true },
                  path: config.path
                }
              ]
            }
        ]
      }
      server.handleMessage(node, meta)
      debug('sending meta for put handler %j', meta)
    }
    server.on('available', onAvailable)

    server.registerPutHandler(node, config.path, handlePut)
    
    node.on('close', function() {
      server.unRegisterPutHandler(node, config.path)
      server.removeListener('available', onAvailable)
    })
  }
  
  RED.nodes.registerType("signalk-put-handler", SignalKOnDelta);
}
