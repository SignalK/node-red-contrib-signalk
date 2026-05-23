
import coreDebug from 'debug'
const debug = coreDebug('node-red-contrib-signalk:signalk-subscribe')

export default function(RED) {
  function input(config) {
    RED.nodes.createNode(this,config);
    var node = this;

    if ( !config.path || config.path.length == 0 ) {
      node.error('no path specified')
      return
    }

    const server = RED.nodes.getNode(config.server)

    if (!server) {
      node.status({ fill: "red", shape: "dot", text: "missing server configuration" })
      return
    }

    let showingStatus = false
    function showStatus(value, title) {
      if ( ! showingStatus ) {
        if ( !title ) {
          title = 'sending'
        }
        node.status({fill:"green",shape:"dot",text: value != null ? `${title} ${value}` : "sending"});
        showingStatus = true;
        setTimeout( () => {
          node.status({});
          showingStatus = false
        }, 1000)
      }
    }

    function on_delta(delta) {
      if ( server.self === undefined ) {
        return
      }
      if ( delta.updates ) {
        try {

          if (typeof config.flatten === 'undefined' || !config.flatten) {
            var copy = JSON.parse(JSON.stringify(delta))
            copy.updates = []
            delta.updates.forEach(update => {
              if (update.values && update.values.length > 0 &&
                (!config.source || update.$source == config.source)) {

                let last = node.context()[update.values[0].path]
                let current = update.values[0].value
                if (typeof last === 'undefined' && config.mode === 'sendChangesIgnore') {
                  showStatus(current, 'ignoring')
                  node.context()[update.values[0].path] = current
                  return
                } else if (!config.mode
                  || config.mode === 'sendAll'
                  || typeof last === 'undefined'
                  || !_.isEqual(last, current)) {
                  node.context()[update.values[0].path] = current
                  copy.updates.push(update)
                } else {
                  showStatus(current, 'ignoring')
                }
              }
            })

            if (copy.updates.length > 0) {
              showStatus(copy.updates[0].values[0].value)
              if (copy.context == server.self) {
                copy.context = 'vessels.self'
              }
              node.send({ payload: copy })
            }
          } else {
            delta.updates.forEach(update => {
              if (update.values &&
                (!config.source || update.$source == config.source)) {
                update.values.forEach(pathValue => {
                  if (pathValue.path !== config.path) {
                    return
                  }
                  let last = node.context()[pathValue.path]
                  let current = pathValue.value
                  if (typeof last === 'undefined'
                    && config.mode === 'sendChangesIgnore') {
                    node.context()[pathValue.path] = current
                    showStatus(current, 'ignoring')
                    return
                  } else if (!config.mode
                    || config.mode === 'sendAll'
                    || typeof last === 'undefined'
                    || !_.isEqual(last, current)) {
                    showStatus(pathValue.value)
                    //debug('sending update for path %s with value %o', pathValue.path, pathValue.value)
                    node.context()[pathValue.path] = current
                    node.send({
                      $source: update.$source,
                      source: update.source,
                      context: delta.context == server.self ? 'vessels.self' : delta.context,
                      payload: pathValue.value,
                      topic: pathValue.path,
                      timestamp: update.timestamp
                    })
                  } else {
                    showStatus(current, 'ignoring')
                  }
                })
              }
            })
          }
        } catch ( err ) {
          server.onError(node, err)
        }
      }
    }

    const onStop = []

    const onAvailable = () => {
      server.subscribe(config.context, config.path, config.period, onStop, on_delta)
    }

    server.on('available', onAvailable)
    
    node.on('close', function() {
      server.removeListener('available', onAvailable)
      onStop.forEach(f => f());
      onStop = []
    })
  }

  RED.nodes.registerType("signalk-subscribe", input);
}
