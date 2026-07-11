'use strict';

module.exports = (client, packet) => {
  const data = packet.d;
  const targetGuildIds = Array.isArray(client.options.targetGuildIds) ? client.options.targetGuildIds : [];
  const allowedDMs = Array.isArray(client.options.allowedDMs) ? client.options.allowedDMs : [];

  if (data.guild_id) {
    // Guild message: drop unless the guild is whitelisted.
    if (!targetGuildIds.includes(data.guild_id)) return;
  } else if (!allowedDMs.includes(data.channel_id)) {
    // DM: drop unless the channel is whitelisted.
    return;
  }

  client.actions.MessageCreate.handle(data);
};
