
import coreDebug from 'debug'
const debug = coreDebug('node-red-contrib-signalk:signalk-send-pathvalue')

export default function(RED) {
  function signalKSendPathValue(config) {
    RED.nodes.createNode(this,config);
    var node = this;

    var source = config.name ? 'node-red-' + config.name : 'node-red'
    var sentMeta = {}

    this.server = RED.nodes.getNode(config.server)

    function showStatus(text) {
      node.status({fill:"green",shape:"dot",text:text});
    }
    
    node.on('input', msg => {
      try {
        const path = config.path ? config.path : msg.topic

        if (this.server.client.connection === undefined) {
          node.error('not connected to Signal K server')
          return
        }

        if (!path) {
          node.error('no topic or path configured')
          return
        }

        if (typeof config.meta !== 'undefined' && config.meta !== "" && !sentMeta[path]) {
          let delta = {
            updates: [
              {
                meta: [
                  {
                    value: JSON.parse(config.meta),
                    path
                  }
                ]
              }
            ]
          }
          if (config.source && config.source.length > 0) {
            delta.updates[0].$source = config.source
          }
          this.server.client.connection.send(delta)
          debug('sending meta for path %s with value %j', path, delta)
          sentMeta[path] = true
        }

        let delta = {
          updates: [
            {
              values: [
                {
                  value: msg.payload,
                  path
                }
              ]
            }
          ]
        }
        if (config.source && config.source.length > 0) {
          delta.updates[0].$source = config.source
        }
        let c = path.lastIndexOf('.')
        debug('sending delta for path %s with value %j', path, delta)
        if (this.server.send(node, delta)) {
          showStatus(`${path.substring(c + 1)}: ${msg.payload}`)
        }
      } catch (err) {
        this.server.onError(node, err)
      }
    })
  }
  RED.nodes.registerType("signalk-send-pathvalue", signalKSendPathValue);
}
