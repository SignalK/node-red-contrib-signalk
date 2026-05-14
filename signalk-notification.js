import coreDebug from 'debug'
const debug = coreDebug('node-red-contrib-signalk:signalk-notification')

export default function(RED) {
  function SignalKNotification(config) {
    RED.nodes.createNode(this,config);
    var node = this;

    const server = RED.nodes.getNode(config.server)

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

    var command = {
      context: "vessels.self",
      subscribe: [{
        path: path,
        policy: 'instant'
      }]
    }

    const onConnect = () => {
      debug('connected, subscribing with', command)
      server.client.subscribe(command)
    }

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

    server.client.on('connect', onConnect)
    
    server.client.on('delta', on_delta)

    node.on('close', function() {
      server.client.removeListener('delta', on_delta)
      server.client.removeListener('connect', onConnect)
    })
  }
  
  RED.nodes.registerType("signalk-notification", SignalKNotification);
}
