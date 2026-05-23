# @signalk/node-red-contrib-signalk

Node-RED nodes for reading from and writing to a Signal K server.

The package is primarily aimed at external Node-RED installations that connect to Signal K over WebSocket using `@signalk/client`. It also ships a small set of nodes that only work inside the embedded Node-RED runtime provided by `signalk-node-red`.

## Install

Install from the Node-RED palette manager by searching for `@signalk/node-red-contrib-signalk`, or install directly in your Node-RED user directory:

```sh
npm install @signalk/node-red-contrib-signalk
```

Restart Node-RED after installation.

## Runtime Modes

There are two ways to use these nodes:

- External Node-RED: connect to a Signal K server with the `signalk-client` config node.
- Embedded Node-RED: run inside `signalk-server` with `signalk-node-red`, where a few nodes talk directly to the server internals.

Most nodes work with the `signalk-client` config node. The following nodes are embedded-only and will show an error status in a normal external Node-RED instance:

- `signalk-app-event`
- `signalk-input-handler`
- `signalk-input-handler-next`
- `signalk-on-delta`
- `signalk-send-nmea0183`
- `signalk-send-nmea2000`

## Signal K Client Config Node

`config-client` provides the shared Signal K connection used by most external nodes.

Configuration fields:

- Host
- Port
- Use TLS
- Username
- Password

The node connects automatically, reconnects when needed, and exposes helper methods for subscribe, PUT, delta send, and path lookup operations.

In embedded mode, the editor auto-creates an internal `signalk-client` config entry named `Embedded` for new `signalk-*` nodes.

## Node Catalog

### Read And Subscribe Nodes

#### `signalk-subscribe`

Subscribes to a Signal K path and emits updates. It supports `vessels.self` or another context, multiple subscription modes, optional source filtering, and flattened output.

With `flatten` enabled, each outgoing message contains a single value in `msg.payload`, the Signal K path in `msg.topic`, and source metadata such as `msg.$source`, `msg.source`, `msg.context`, and `msg.timestamp`.

#### `signalk-notification`

Subscribes to notifications and emits messages for matching notification paths and states such as `normal`, `alert`, `warn`, `alarm`, or `emergency`.

#### `signalk-get`

Looks up a single current value from the configured Signal K server. The node uses the configured `path`, or falls back to `msg.topic`.

It has two outputs:

- Output 1: value found, emitted as `msg.payload`
- Output 2: value not found

#### `signalk-on-delta`

Embedded-only. Listens to every delta the local Signal K server receives and emits either the full delta or flattened path/value messages.

When flattening is enabled, the node emits one message per value and includes `topic`, `payload`, `context`, `source`, and `$source`. Deltas originating from `signalk-node-red` are filtered out to avoid loops.

#### `signalk-app-event`

Embedded-only. Listens for a named event emitted on the server `app` object and forwards the event payload as `msg.payload`.

### Processing Nodes

#### `signalk-flatten-delta`

Converts a Signal K delta in `msg.payload` into one output message per path/value pair.

#### `signalk-filter-delta`

Filters a delta and emits only the matching path entries. The outgoing `msg.payload` contains the selected path/value object, with `$source` and `source` copied from the originating update.

#### `signalk-delay`

Delays forwarding until the input payload has remained unchanged for the configured time. This is useful for filtering transient state changes.

#### `signalk-geofence`

Checks vessel position against a circular geofence.

It has three outputs:

- Output 1: inside fence
- Output 2: outside fence
- Output 3: either state, typically with an inside/outside indicator

You can update the fence at runtime by sending a payload containing `latitude`, `longitude`, and `distance`.

#### `signalk-geofence-switch`

Routes an incoming message based on whether the current vessel position is inside or outside a configured fence.

It has two outputs:

- Output 1: inside fence
- Output 2: outside fence

Runtime configuration updates can be sent with `msg.topic = "signalk-config"` and a payload containing `latitude`, `longitude`, and `distance`.

### Write And Control Nodes

#### `signalk-send-pathvalue`

Sends a single Signal K value update. The path comes from the node configuration or `msg.topic`, and the value comes from `msg.payload`.

The node can also attach a configured `$source` and optional metadata for the path.

#### `signalk-send-delta`

Sends a complete Signal K delta from `msg.payload`.

#### `signalk-send-notification`

Sends notification updates. Node configuration can define the notification path, state, method, and message, and an object payload can override them per message.

If needed, the node automatically prefixes the path with `notifications.`.

#### `signalk-send-put`

Sends a Signal K PUT request using the configured server connection.

It has two outputs:

- Output 1: successful completion
- Output 2: failed completion

The path comes from the node configuration or `msg.topic`, and the value comes from `msg.payload`.

#### `signalk-put-handler`

Registers PUT support for a specific Signal K path and emits incoming PUT requests into the flow.

If `Use Put Response` is disabled, the node responds immediately with `COMPLETED 200`. If enabled, it returns `PENDING 202` and expects a later response from `signalk-put-success` or `signalk-put-error`.

The outgoing message includes the requested path in `msg.topic`, the requested value in `msg.payload`, and a `requestId` used to complete the request later.

#### `signalk-put-success`

Completes a pending PUT request successfully. It expects `msg.requestId` and optionally accepts `msg.statusCode` and `msg.message`.

#### `signalk-put-error`

Completes a pending PUT request with an error. It expects `msg.requestId` and optionally accepts `msg.statusCode` and `msg.message`.

### NMEA Output Nodes

#### `signalk-send-nmea0183`

Embedded-only. Emits an event on the local Signal K server to send an NMEA 0183 sentence. `msg.payload` should be an NMEA 0183 string.

#### `signalk-send-nmea2000`

Embedded-only. Emits an event on the local Signal K server to send NMEA 2000 output.

If `msg.payload` is an object, the node sends it using the configured JSON event name. Otherwise it sends the payload using the configured raw event name. This supports canboat JSON or a raw Actisense-formatted string.

### UI Switch Nodes

These nodes maintain state in the global `skpersist` context store, which defaults to local storage.

#### `signalk-toggle-switch`

Represents a boolean switch for a Signal K path. If the configured path does not end with `.state`, the suffix is appended automatically.

#### `signalk-multi-switch`

Represents a multi-position switch backed by a configured list of options. Incoming `msg.payload` must match one of the configured option values.

Option values can be strings or numbers, and all configured options must use the selected type.

#### `signalk-dimmer-switch`

Represents a dimmer control. It always publishes a `.dimmingLevel` path with a numeric value between `0` and `1`.

If `Include State` is enabled, it also publishes a boolean `.state` path. Input may be a number, a boolean, or an object with `dimmingLevel` and optional `state`.

#### `signalk-slider-switch`

Represents a numeric slider for a Signal K path. If the configured path does not end with `.state`, the suffix is appended automatically.

The value must be numeric and within the configured range. Optional units and step size are supported for the editor UI.

### Embedded Delta Interception Nodes

#### `signalk-input-handler`

Embedded-only. Registers a handler for incoming deltas before they are applied to the local Signal K server. This lets a flow inspect, modify, or suppress updates for a matching context, path, and optional source.

The emitted message includes the intercepted value and a continuation callback used by the companion next node.

#### `signalk-input-handler-next`

Embedded-only. Passes a modified or reconstructed delta back into the original input pipeline after processing by `signalk-input-handler`.

If `msg.topic` is set, the node builds a delta from the message fields and forwards it to the saved continuation callback.

## Example Flows

### Read One Path

1. Add a `signalk-client` config node.
2. Add `signalk-subscribe`.
3. Configure `path` to something like `navigation.speedOverGround`.
4. Set mode to `sendChanges`.
5. Wire the output to a Debug node.

### Read A Current Value On Demand

1. Add a `signalk-client` config node.
2. Add `signalk-get`.
3. Either configure a fixed path or send the path in `msg.topic`.
4. Use output 1 for the value and output 2 for not-found handling.

### Handle PUT Requests Asynchronously

1. Add `signalk-put-handler` and enable delayed responses.
2. Process the request in your flow.
3. Pass the same `requestId` to `signalk-put-success` or `signalk-put-error` when the operation completes.

## Notes

- External installations should use `signalk-client` for all server communication.
- Embedded-only nodes depend on globals provided by `signalk-server` and `signalk-node-red`.
- This package is published as an ES module package, so the shipped node implementations use `export default`.

## License

Apache-2.0
