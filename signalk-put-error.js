import coreDebug from 'debug'
const debug = coreDebug('node-red-contrib-signalk:signalk-put-error')

export default function(RED) {
  function SignalK(config) {
    RED.nodes.createNode(this,config);
    var node = this;

    const server = RED.nodes.getNode(config.server)

    node.on('input', msg => {
      if (msg.requestId) {
        const resp = {
          requestId: msg.requestId,
          "state": "COMPLETED",
          "statusCode": msg.statusCode || 500,
          message: msg.message
        }
        debug('sending put error response %j', resp)
        server.client.connection.send(resp)
      } else {
        node.error('No requestId provided for put response')
      }
    })
  }
  RED.nodes.registerType("signalk-put-error", SignalK);
}

