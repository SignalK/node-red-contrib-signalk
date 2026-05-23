import coreDebug from 'debug'
const debug = coreDebug('node-red-contrib-signalk:signalk-notification')

export default function(RED) {
  function SignalKNotification(config) {
    RED.nodes.createNode(this,config);
    var node = this;

    const server = RED.nodes.getNode(config.server)

    if (!server) {
      node.status({ fill: "red", shape: "dot", text: "missing server configuration" })
      return
    }

    let showingStatus = false
    function showStatus() {
      if ( ! showingStatus ) {
        node.status({fill:"green",shape:"dot",text:"sending"});
        showingStatus = true;
        setTimeout( () => {
          node.status({});
          showingStatus = false
        }, 1000)
      }
    }
    
    var path = config.notification === 'any' || config.notification.length === 0 ? 'notifications.*' : config.notification

    const on_delta = delta => {
      try {
        let notification = delta.updates[0].values[0]

        debug('received notification', notification)
        debug('config state', config.state)

        if (config.state === 'any' || (notification.value && notification.value.state == config.state)) {
          showStatus()
          node.send({ payload: notification })
        }
      } catch (err) {
        server.onError(node, err)
      }
    }

    const onStop = []

    const onAvailable = () => {
      debug('connected, subscribing with path %s', path)
      server.subscribe('vessels.self', path, undefined, onStop, on_delta)
    }

    server.on('available', onAvailable)

    node.on('close', function() {
      server.removeListener('available', onAvailable)
      onStop.forEach(f => f())
    })
  }
  
  RED.nodes.registerType("signalk-notification", SignalKNotification);
}
