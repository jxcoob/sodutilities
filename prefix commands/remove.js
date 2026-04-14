const config = require('../config.js');
const { removedRoles } = require('../store.js');

async function resolveUser(guild, input) {
  const mentionMatch = input.match(/^<@!?(\d+)>$/);
  if (mentionMatch) return guild.members.fetch(mentionMatch[1]).catch(() => null);
  if (/^\d+$/.test(input)) return guild.members.fetch(input).catch(() => null);
  const results = await guild.members.search({ query: input, limit: 5 }).catch(() => null);
  if (!results) return null;
  return results.find(m =>
    m.user.username.toLowerCase() === input.toLowerCase() ||
    m.user.tag.toLowerCase() === input.toLowerCase() ||
    m.displayName.toLowerCase() === input.toLowerCase()
  ) || null;
}

module.exports = {
  name: 'remove',
  async execute(message, args) {
    if (!args.length) {
      return message.reply('Usage: `-remove <user>`').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
    const target = await resolveUser(message.guild, args[0]);
    if (!target) {
      return message.reply('Could not find that user.').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }

    const rolesToRemove = config.roles.removableRoles.filter(id => target.roles.cache.has(id));
    if (!rolesToRemove.length) {
      return message.reply(`${target.user.tag} does not have any of the configured removable roles.`)
        .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }

    await target.roles.remove(rolesToRemove).catch(() => {});
    removedRoles.set(target.id, rolesToRemove);

    await message.delete().catch(() => {});
    const notice = await message.channel.send(`Removed **${rolesToRemove.length}** role(s) from ${target.user.tag}.`);
    setTimeout(() => notice.delete().catch(() => {}), 5000);
  },
};
