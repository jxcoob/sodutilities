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
  name: 'restore',
  async execute(message, args) {
    if (!args.length) {
      return message.reply('Usage: `-restore <user>`').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }
    const target = await resolveUser(message.guild, args[0]);
    if (!target) {
      return message.reply('Could not find that user.').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }

    const stored = removedRoles.get(target.id);
    if (!stored || !stored.length) {
      return message.reply(`No removed roles on record for ${target.user.tag}.`)
        .then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }

    await target.roles.add(stored).catch(() => {});
    removedRoles.delete(target.id);

    await message.delete().catch(() => {});
    const notice = await message.channel.send(`Restored **${stored.length}** role(s) to ${target.user.tag}.`);
    setTimeout(() => notice.delete().catch(() => {}), 5000);
  },
};
