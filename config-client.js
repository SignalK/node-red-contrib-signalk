
import { Client } from '@signalk/client'

import coreDebug from 'debug'

export default function (RED) {
  'use strict'

  function ConfigSignalKClient (config) {
    RED.nodes.createNode(this, config)

    this.hostname = config.hostname
    this.port = config.port

    const debug = coreDebug(`node-red-contrib-signalk:config-client-${this.hostname}:${this.port}`)

    this.client = new Client({
      hostname: this.hostname,
      port: this.port,
      deltaStreamBehaviour: 'none',
      wsKeepaliveInterval: 10,
      reconnect: true,
      rejectUnauthorized: false,
      username: config.username,
      password: config.password,
      useTLS: config.useTLS,
      autoConnect: false,
      notifications: false
    })

    this.client.connect()
    .then(() => {
      debug('connected to server, self', this.client.self)
    })
    .catch(err => {
      debug('connection error:', err)
      this.error('Error connecting to Signal K server: ' + err.message)
    })

    this.client.on('connect', () => {
      if ( config.username && config.password ) {
        debug('authenticating...')
        this.client.authenticate(config.username, config.password)
      }
      this.client.emit('authenticated')
    })

    this.client.on('self', (self) => {
      this.self = self
    })

    debug('created with hostname %s and port %d', this.hostname, this.port)
    
    this.on('close', (done) => {
      debug('closing connection')
      if (this.client) {
        this.client.close()
      }
      done()
    })

    this.client.on('error', (err) => {
      this.error('error: ' + JSON.stringify(err))
    })

    this.onError = (node, err) => {
      node.error(err)
      node.status({fill:"red",shape:"dot",text:err.message})
    }

    this.send = (node, msg) => {
      return new Promise((resolve, reject) => {
        if (this.client && this.client.connection) {
          this.client.connection.send(msg)
            .then(() => {
              resolve(true)
            })
            .catch(err => {
              node.error('error sending message: ' + JSON.stringify(err))
              node.status({ fill: "red", shape: "dot", text: 'error sending message' })
              resolve(false)
            })
        } else {
          const msg = 'Not connected to Signal K server'
          node.error(msg)
          node.status({ fill: "red", shape: "dot", text: msg })
          resolve(false)
        }
      })
    }

    this.registerPutHandler = (node, path, handler) => {
      if ( !this.putHandlers ) {
        this.putHandlers = []
        const onMessage = msg => {
          if ( msg.put ) {
            try {
              msg.put.forEach(pv => {
                const handler = this.putHandlers.find(h => h.path === pv.path)
                if (handler) {
                  debug('received put %j', msg)
                  let result = handler.func(config.context, pv.path, pv.value, msg.requestId)
  //                const resp = { requestId: msg.requestId, ...result }
                  result.requestId = msg.requestId
                  debug('sending response %j %j', result, msg.requestId)
                  this.send(handler.node, result)
                }
              });
            } catch (err) {
              this.error(err)
            }
          }
        }
        this.client.on('message', onMessage)
      }
      this.putHandlers.push({ path, func: handler, node})
    }

    this.unRegisterPutHandler = (node, path) => {
      if ( this.putHandlers ) {
        this.putHandlers = this.putHandlers.filter(h => h.path !== path || h.node !== node)
      }
    }

    this.handleMessage = (node, delta) => {
      this.send(node, delta)
    }
  }

  RED.nodes.registerType('signalk-client', ConfigSignalKClient)
}


/*

    let hasClient = false
    RED.nodes.eachConfig(function (n) {
      if (n.id === 'sk-embeded-id')
        hasClient = true
    });

    console.log('has client?', RED.nodes.getNode('sk-embeded-id'))
    if (!hasClient) {
      var clientNode = {
        id: "sk-embeded-id",
        _def: RED.nodes.getType("signalk-client"),
        type: "signalk-client",
        valid: true,
        isEmbedded: true
      };
      RED.nodes.add(clientNode);
      RED.nodes.dirty(true);
    }


*/