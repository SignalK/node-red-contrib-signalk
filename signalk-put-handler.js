
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
        if ( server.send(node, resp) ) {
          debug('sending put response %j', resp)
        }
        return { state: 'PENDING' }
      } else {
        node.send({topic: path, payload: value})
        const resp = {
          requestId: requestId,
          "state": "COMPLETED",
          "statusCode": 200
        }
        if ( server.send(node, resp) ) {
          debug('sending put response %j', resp)
        }
        return { state: 'SUCCESS' }
      }
    }

    const onConnect = () => {
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
      if ( server.send(node, meta) ) {
        debug('sending meta for put handler %j', meta)
      }
    }
    server.client.on('connect', onConnect)

    const onMessage = msg => {
      if ( msg.put ) {
        try {
          msg.put.forEach(pv => {
            if (pv.path === config.path) {
              debug('received put %j', msg)
              let result = handlePut(config.context, pv.path, pv.value, msg.requestId)
              if (result.state === 'PENDING') {
                debug('put handler is pending for path %s with value %j', pv.path, pv.value)
              } else {
                debug('put handler is successful for path %s with value %j', pv.path, pv.value)
              }
            }
          });
        } catch (err) {
          server.onError(node, err)
        }
      }
    }
    server.client.on('message', onMessage)

    node.on('close', function() {
      server.client.removeListener('message', onMessage)
      server.client.removeListener('connect', onConnect)
    })
  }
  
  RED.nodes.registerType("signalk-put-handler", SignalKOnDelta);
}
