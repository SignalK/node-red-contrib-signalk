
import coreDebug from 'debug'
const debug = coreDebug('node-red-contrib-signalk:signalk-put-handler')

export default function(RED) {
  function SignalKOnDelta(config) {
    RED.nodes.createNode(this,config);
    var node = this;

    const server = RED.nodes.getNode(config.server)

    function handlePut(context, path, value, requestId) {
      if ( config.pending ) {
        node.send({topic: path, payload: value, requestId})
        const resp = {
          requestId: requestId,
          "state": "PENDING",
          "statusCode": 202
        }
        debug('sending put response %j', resp)
        server.client.connection.send(resp)
        return { state: 'PENDING' }
      } else {
        node.send({topic: path, payload: value})
        const resp = {
          requestId: requestId,
          "state": "COMPLETED",
          "statusCode": 200
        }
        debug('sending put response %j', resp)
        server.client.connection.send(resp)
        return { state: 'SUCCESS' }
      }
    }

    server.client.on('connect', () => {
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
      debug('sending meta for put handler %j', meta)
      server.client.connection.send(meta)
    })
    server.client.on('message', msg => {
      if ( msg.put ) {
        msg.put.forEach(pv => {
          if ( pv.path === config.path ) {
            debug('received put %j', msg)
            let result = handlePut(config.context, pv.path, pv.value, msg.requestId)
            if ( result.state === 'PENDING' ) {
              debug('put handler is pending for path %s with value %j', pv.path, pv.value)
            } else {
              debug('put handler is successful for path %s with value %j', pv.path, pv.value)
            }
          }
        });
      }
    })
  }
  
  RED.nodes.registerType("signalk-put-handler", SignalKOnDelta);
}
