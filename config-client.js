
import { Client } from '@signalk/client'

import coreDebug from 'debug'

export default function (RED) {
  'use strict'

  const debug = coreDebug('node-red-contrib-signalk:config-client')

  function ConfigSignalKClient (config) {
    debug('ConfigSignalKClient constructor called')

    RED.nodes.createNode(this, config)

    this.hostname = config.hostname
    this.port = config.port

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
      debug('ConfigSignalKClient connected to server, self', this.client.self)

      this.client.authenticate(config.username, config.password)
    })
    .catch(err => {
      debug('ConfigSignalKClient connection error:', err)
      this.error('Error connecting to Signal K server: ' + err.message)
    })

    debug('ConfigSignalKClient created with hostname %s and port %d', this.hostname, this.port)
    
    this.on('close', function (done) {
      debug('ConfigSignalKClient closing connection')
      if (this.client) {
        this.client.close()
      }
      done()
    })

    this.on('error', function (err) {
      console.error('ConfigSignalKClient error:', err)
    })
  }

  RED.nodes.registerType('signalk-client', ConfigSignalKClient)
}
