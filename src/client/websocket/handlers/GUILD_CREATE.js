'use strict';

const { Events, Opcodes, Status } = require('../../../util/Constants');

const run = (client, guild) => {
  const subs = {};
  subs[guild.id] = {
    typing: true,
    threads: true,
    activities: true,
    member_updates: true,
    thread_member_lists: [],
    members: [],
    channels: {},
  };
  client.ws.broadcast({
    op: Opcodes.GUILD_SUBSCRIPTIONS_BULK,
    d: {
      subscriptions: subs,
    },
  });
};

module.exports = (client, { d: data }, shard) => {
  if (!Array.isArray(client.options.targetGuildIds)) client.options.targetGuildIds = [];

  const inCache = client.guilds.cache.has(data.id);
  const isTargeted = client.options.targetGuildIds.includes(data.id);

  // New Join Exception: a guild not in cache and not yet whitelisted means the client
  // just joined it. Dynamically whitelist it so it (and its future events) bypass filtration.
  if (!inCache && !isTargeted) {
    client.options.targetGuildIds.push(data.id);
  } else if (!isTargeted) {
    // Non-targeted guild (present in the payload but not whitelisted): gut its payload
    // properties before any manager allocates Collections for them.
    data.channels = [];
    data.members = [];
    data.presences = [];
    data.voice_states = [];
    data.emojis = [];
    data.stickers = [];
    data.threads = [];
    data.stage_instances = [];
  }

  // For ALL guilds, strip the roles array to eliminate the role/permission manager footprint.
  data.roles = [];

  let guild = client.guilds.cache.get(data.id);
  run(client, data);
  if (guild) {
    if (!guild.available && !data.unavailable) {
      // A newly available guild
      guild._patch(data);
      /**
       * Emitted whenever a guild becomes available.
       * @event Client#guildAvailable
       * @param {Guild} guild The guild that became available
       */
      client.emit(Events.GUILD_AVAILABLE, guild);
    }
  } else {
    // A new guild
    data.shardId = shard.id;
    guild = client.guilds._add(data);
    if (client.ws.status === Status.READY) {
      /**
       * Emitted whenever the client joins a guild.
       * @event Client#guildCreate
       * @param {Guild} guild The created guild
       */
      client.emit(Events.GUILD_CREATE, guild);
      run(client, guild);
    }
  }
};
