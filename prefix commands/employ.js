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



    // ── Build and send DM embed ──────────────────────────
    const embed = new EmbedBuilder()
      .setColor(config.embedColor)
      .setTitle('SWAT Employment')
      .setDescription(
        `Congratulations! You've successfully entered the 1-2 week probationary phase as a cadet to become an operator within SWAT. During this phase ensure to attend at least one deployment a week. The results of your cadet phase will be determined at the end of the 1-2 weeks with an exam.\n\n` +
        `If passed, you will officially become an operator within SWAT. Please note, during this 1-2 week probationary phase, you will be closely observed. Ensure to follow all policies and regulations within the SWAT handbook which can be found here: https://discord.com/channels/1461871920893923372/1493719074960834660 .`
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
