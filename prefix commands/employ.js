const config = require('../config.js');
const { EmbedBuilder } = require('discord.js');

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
  name: 'employ',
  async execute(message, args) {
    if (!args.length) {
      return message.reply('Usage: `-employ <user>`').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }

    const target = await resolveUser(message.guild, args[0]);
    if (!target) {
      return message.reply('Could not find that user.').then(m => setTimeout(() => m.delete().catch(() => {}), 5000));
    }

    // ── Give employment roles ────────────────────────────
    const rolesToAdd = config.roles.employmentRoles.filter(id => !target.roles.cache.has(id));
    if (rolesToAdd.length) {
      await target.roles.add(rolesToAdd).catch(() => {});
    }

    // ── Remove role on employment ────────────────────────
    if (target.roles.cache.has(config.roles.employmentRemoveRole)) {
      await target.roles.remove(config.roles.employmentRemoveRole).catch(() => {});
    }

    // ── Build and send DM embed ──────────────────────────
    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle('SWAT Employment')
      .setDescription(
        `Congratulations! You've successfully passed all phases for our entry process and you are officially an operator within the Special Weapons & Tactics Team.\n\n` +
        `SWAT Command is proud of your hard work and dedication to the team. If you have any questions, feel free to reach out to a supervisor or command member.`
      )
      .setImage(config.embedImageUrl)
      .setFooter({ text: 'SWAT Employment' })
      .setTimestamp();

    const dmSent = await target.send({ embeds: [embed] }).catch(() => null);

    await message.delete().catch(() => {});

    if (!dmSent) {
      const notice = await message.channel.send(
        `${target.user.tag} has been employed and given **${rolesToAdd.length}** role(s), but their DMs are disabled so the employment message could not be sent.`
      );
      return setTimeout(() => notice.delete().catch(() => {}), 6000);
    }

    const notice = await message.channel.send(`${target.user.tag} has been successfully employed and notified via DM.`);
    setTimeout(() => notice.delete().catch(() => {}), 5000);
  },
};