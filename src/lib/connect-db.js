const { MongoClient } = require('mongodb')

/*
 * One MongoDB connection, shared by everything on this server.
 *
 * A client is only kept once it has actually connected. If connecting fails (the database
 * is slow or unreachable for a moment), the driver closes that client, and keeping it would
 * leave every later request failing with "Topology is closed" until the server restarted:
 * so a failed attempt is forgotten and the next request tries again. The same goes for a
 * connection that closes later on. Requests that arrive while it's connecting all wait on
 * that one attempt, rather than each opening their own.
 */

let mongoClient = null // the connected client, once there is one
let connecting = null // the attempt in progress

function forget(client) {
  if (mongoClient === client) mongoClient = null
}

async function connectMongo() {
  if (mongoClient) return mongoClient
  if (!connecting) {
    const client = new MongoClient(process.env.MONGODB_URI)
    // closed for any reason later on: the next request connects afresh
    client.on('topologyClosed', () => forget(client))
    connecting = client
      .connect()
      .then(() => {
        mongoClient = client
        console.log('MongoClient connected.')
        return client
      })
      .catch((error) => {
        // don't keep a client that never connected
        client.close().catch(() => {})
        throw error
      })
      .finally(() => {
        connecting = null
      })
  }
  return connecting
}

function getMongoClient() {
  if (!mongoClient) {
    throw new Error("MongoDB client not initialized. Call connectMongo() first.");
  }
  return mongoClient;
}

module.exports = { connectMongo, getMongoClient };
