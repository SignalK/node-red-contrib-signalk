# @signalk/node-red-contrib-signalk

Node-RED nodes for reading from and writing to a Signal K server.

This package is intended for external Node-RED installs that connect to Signal K over WebSocket using `@signalk/client`.

## Install

Search for node-red-contrib-signalk in the node-red Pallete Manager

## Signal K Client Config Node

Most nodes use the `signalk-client` config node.

Config fields:

- Host
- Port
- Use TLS
- Username
- Password

The config node connects and authenticates automatically.

## Node Reference

### Inputs / Subscriptions

#### `signalk-subscribe` (0 in / 1 out)

Subscribe to a Signal K path and emit updates.

Key options:

- `path` (required)
- `context` (default `vessels.self`)
- `mode`: `sendAll`, `sendChanges`, `sendChangesIgnore`
- `flatten`: output each path/value as a simple message
- `source`: optional `$source` filter
- `period`: subscription period in ms

When `flatten` is enabled, output looks like:

```json
{
  "topic": "navigation.speedOverGround",
  "payload": 2.45,
  "source": {
    "label": "actisense",
    "type": "NMEA2000",
    "pgn": 129026,
    "src": "3"
  },
  "context": "vessels.self",
  "$source": "actisense.3",
  "timestamp": "2026-05-14T12:00:00.000Z"
}
```

#### `signalk-notification` (0 in / 1 out)

Subscribe to notification updates and emit messages for matching state/path.

Options:

- `notification`: a notification path (or leave empty for all)
- `state`: `any`, `normal`, `alert`, `warn`, `alarm`, `emergency`

Output:

```json
{
  "payload": {
    "path": "notifications.anchor",
    "value": {
      "state": "alarm",
      "method": ["visual", "sound"],
      "message": "Anchor alarm"
    }
  }
}
```

#### `signalk-geofence` (1 in / 3 out)

Checks vessel position against a circular fence.

Outputs:

- Output 1: inside fence
- Output 2: outside fence
- Output 3: either state (`inside` or `outside`)

Input can update the fence center/radius:

```json
{
  "payload": {
    "latitude": 60.15,
    "longitude": 24.88,
    "distance": 150
  }
}
```

If `Use My Position` is enabled, the fence center tracks `vessels.self.navigation.position`.

#### `signalk-put-handler` (0 in / 1 out)

Handles incoming PUT requests for one path.

Behavior:

- On connect, publishes metadata with `supportsPut: true` for the configured path.
- Emits PUT requests as Node-RED messages.
- If `Use Put Response` is disabled, responds immediately with `COMPLETED 200`.
- If enabled, responds with `PENDING 202` and expects a later `signalk-put-success` or `signalk-put-error` response.

Output message:

```json
{
  "topic": "electrical.switches.anchorLight.state",
  "payload": true,
  "requestId": "..."
}
```

### Processing Nodes

#### `signalk-flatten-delta` (1 in / 1 out)

Flattens a Signal K delta (`msg.payload`) into one output per `path/value`.

Output fields include `topic`, `payload`, `context`, `$source`, and `source`.

#### `signalk-geofence-switch` (1 in / 2 out)

Routes an incoming message by geofence result.

- Output 1: inside fence (passes original message)
- Output 2: outside fence (passes original message)

You can update config at runtime by sending:

- `msg.topic = "signalk-config"`
- `msg.payload = { latitude, longitude, distance }`

#### `signalk-delay` (1 in / 1 out)

Delays forwarding until the payload has stayed unchanged for `delay` milliseconds.

Useful for suppressing short transients (for example, startup voltage dips).

### Outputs / Writers

#### `signalk-send-pathvalue` (1 in / 0 out)

Sends a delta value update.

- Path from configured `path` or `msg.topic`
- Value from `msg.payload`
- Optional configured `$source`
- Optional configured `meta` JSON (sent once per path)

Example input:

```json
{
  "topic": "navigation.speedOverGround",
  "payload": 5.3
}
```

#### `signalk-send-delta` (1 in / 0 out)

Sends a fully formed Signal K delta from `msg.payload`.

#### `signalk-send-notification` (1 in / 0 out)

Sends notification deltas.

- Uses node config by default
- If `msg.payload` is an object, it can override `path`, `state`, `method`, `message`, and `$source`
- `path` is auto-prefixed with `notifications.` if needed

Example input:

```json
{
  "payload": {
    "path": "notifications.anchor",
    "state": "alarm",
    "method": ["visual", "sound"],
    "message": "Anchor alarm"
  }
}
```

#### `signalk-send-put` (1 in / 2 out)

Sends a Signal K PUT request.

- Path from configured `path` or `msg.topic`
- Value from `msg.payload`
- Context defaults to `vessels.self`
- Optional configured source

Outputs:

- Output 1: success (`COMPLETED 200`)
- Output 2: error (non-200 completion)

#### `signalk-put-success` (1 in / 0 out)

Responds to a pending PUT request with success.

Expected input:

- `msg.requestId` (required)
- `msg.statusCode` (optional, default `200`)
- `msg.message` (optional)

#### `signalk-put-error` (1 in / 0 out)

Responds to a pending PUT request with an error.

Expected input:

- `msg.requestId` (required)
- `msg.statusCode` (optional, default `500`)
- `msg.message` (optional)

## Typical Flow Patterns

### Read a single path and only emit changes

1. Add `signalk-subscribe`.
2. Set `path` (for example `navigation.speedOverGround`).
3. Set mode to `sendChanges`.
4. Connect to debug/function nodes.

### Handle remote PUT requests asynchronously

1. Add `signalk-put-handler` with `Use Put Response` enabled.
2. Process request in your flow.
3. Send success to `signalk-put-success` or failure to `signalk-put-error` using the same `requestId`.

## License

Apache-2.0
