
import coreDebug from 'debug'
const debug = coreDebug('node-red-contrib-signalk:signalk-send-notification')

export default function(RED) {
  function signalKSendNotification(config) {
    RED.nodes.createNode(this,config);
    var node = this;

    const server = RED.nodes.getNode(config.server)

    let showingStatus = false
    function showStatus(text) {
      if ( ! showingStatus ) {
        node.status({fill:"green",shape:"dot",text:text});
        showingStatus = true;
        setTimeout( () => {
          node.status({});
          showingStatus = false
        }, 1000)
      }
    }
    
    node.on('input', msg => {
      try {
        let info = typeof msg.payload === 'object' ? msg.payload : null
        let path = info && info.path ? info.path : config.path
        let state = info && info.state ? info.state : config.state
        let message = info && info.message ? info.message : config.message
        let source = info && info.$source ? info.$source : config.source
        let method
        if (info && info.method) {
          method = info.method
        } else {
          method = []
          if (config.visual) {
            method.push('visual')
          }
          if (config.sound) {
            method.push('sound')
          }
        }

        if (typeof source !== 'undefined' && source.length === 0) {
          source = undefined
        }

        if (!path.startsWith('notifications.')) {
          path = 'notifications.' + path
        }

        let delta = {
          updates: [
            {
              $source: source,
              values: [
                {
                  path,
                  value: {
                    state: state,
                    method: method,
                    message: message
                  }
                }
              ]
            }
          ]
        }
        if ( server.send(node, delta) ) {
          debug('sending notification with delta %j', delta)
          showStatus(`sent notification ${path}=${state}`)
        }
      } catch (err) {
        server.onError(node, err)
      }
    })
  }
  RED.nodes.registerType("signalk-send-notification", signalKSendNotification);
}
