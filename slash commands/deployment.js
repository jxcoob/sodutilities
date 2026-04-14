const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} = require('discord.js');
const config = require('../config.js');

// ── In-memory store for active deployment votes ────────────
const activeVotes = new Map();

// ── Helper: check if member has a permitted command role ───
function hasDeploymentPermission(member) {
  return config.roles.deploymentCommandRoles.some(roleId =>
    member.roles.cache.has(roleId)
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('deployment')
    .setDescription('SWAT Deployment commands')
    .addSubcommand(sub =>
      sub
        .setName('vote')
        .setDescription('Initiate a deployment vote')
        .addIntegerOption(opt =>
          opt
            .setName('votes_required')
            .setDescription('How many attendance votes are required to start the deployment')
            .setRequired(true)
            .setMinValue(1)
        )
        .addIntegerOption(opt =>
          opt
            .setName('minutes')
            .setDescription('In how many minutes will this deployment commence?')
            .setRequired(true)
            .setMinValue(1)
        )
    )
    .addSubcommand(sub =>
      sub
        .setName('end')
        .setDescription('End the current deployment')
    ),

  async execute(interaction) {
    if (!hasDeploymentPermission(interaction.member)) {
      return interaction.reply({
        content: 'Permission denied.',
        ephemeral: true,
      });
    }

    const sub = interaction.options.getSubcommand();

    // ── /deployment vote ──────────────────────────────────
    if (sub === 'vote') {
      const votesRequired = interaction.options.getInteger('votes_required');
      const minutes = interaction.options.getInteger('minutes');
      const startTimestamp = Math.floor(Date.now() / 1000) + minutes * 60;
      const durationMs = minutes * 60 * 1000;

      const channel = interaction.guild.channels.cache.get(config.channels.deploymentChannel);
      if (!channel) {
        return interaction.reply({ content: 'Deployment channel not found. Contact SWAT Command.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle('SWAT - Deployment Vote')
        .setDescription(
          `A deployment vote has been initiated. All operators that are available to attend may mark their attendance below. Failure to join the deployment after marking your attendance will result in disciplinary action.\n\n` +
          `**Votes Required:** ${votesRequired}\n\n` +
          `This deployment will commence <t:${startTimestamp}:R>`
        )
        .setImage(config.embedImageUrl)
        .setFooter({ text: 'SWAT Deployment Vote' })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('deployment_attend')
          .setLabel('Mark Attendance')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('deployment_view')
          .setLabel('View Attendance')
          .setStyle(ButtonStyle.Secondary),
      );

      const message = await channel.send({
        content: `<@&${config.roles.deploymentPingRole}>`,
        embeds: [embed],
        components: [row],
      });

      activeVotes.set(message.id, {
        attendees: new Set(),
        votesRequired,
        startTimestamp,
        channelId: channel.id,
        messageId: message.id,
      });

      // ── Button Collector — runs for the full duration ───
      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: durationMs,
      });

      collector.on('collect', async i => {
        const voteData = activeVotes.get(message.id);
        if (!voteData) return;

        // Mark Attendance
        if (i.customId === 'deployment_attend') {
          if (voteData.attendees.has(i.user.id)) {
            const removeRow = new ActionRowBuilder().addComponents(
              new ButtonBuilder()
                .setCustomId('deployment_remove_confirm')
                .setLabel('Remove Attendance')
                .setStyle(ButtonStyle.Danger),
            );

            // fetchReply: true so we get back the ephemeral message and can attach a collector
            const removeReply = await i.reply({
              content: `You've already marked yourself attending to this deployment, would you like to remove your attendance?`,
              components: [removeRow],
              ephemeral: true,
              fetchReply: true,
            });

            // Collect the remove-confirm click on the ephemeral message
            const removeCollector = removeReply.createMessageComponentCollector({
              componentType: ComponentType.Button,
              time: 60_000,
              max: 1,
            });

            removeCollector.on('collect', async removeInteraction => {
              if (removeInteraction.customId !== 'deployment_remove_confirm') return;

              const voteDataNow = activeVotes.get(message.id);
              if (!voteDataNow) {
                await removeInteraction.update({ content: 'This deployment vote is no longer active.', components: [] });
                return;
              }

              if (!voteDataNow.attendees.has(i.user.id)) {
                await removeInteraction.update({ content: 'You are not currently marked as attending.', components: [] });
                return;
              }

              voteDataNow.attendees.delete(i.user.id);

              const updatedEmbed = EmbedBuilder.from(message.embeds[0])
                .setDescription(
                  `A deployment vote has been initiated. All operators that are available to attend may mark their attendance below. Failure to join the deployment after marking your attendance will result in disciplinary action.\n\n` +
                  `**Votes Required:** ${voteDataNow.votesRequired}\n` +
                  `**Current Votes:** ${voteDataNow.attendees.size}/${voteDataNow.votesRequired}\n\n` +
                  `This deployment will commence <t:${voteDataNow.startTimestamp}:R>`
                );

              await message.edit({ embeds: [updatedEmbed] }).catch(() => {});
              await removeInteraction.update({ content: 'Your attendance has been removed.', components: [] });
            });

            removeCollector.on('end', (collected, reason) => {
              if (reason === 'time' && collected.size === 0) {
                i.editReply({ content: 'Remove request timed out.', components: [] }).catch(() => {});
              }
            });

            return;
          }

          voteData.attendees.add(i.user.id);
          await i.reply({ content: 'Attendance succesfully marked.', ephemeral: true });

          const updatedEmbed = EmbedBuilder.from(message.embeds[0])
            .setDescription(
              `A deployment vote has been initiated. All operators that are available to attend may mark their attendance below. Failure to join the deployment after marking your attendance will result in disciplinary action.\n\n` +
              `**Votes Required:** ${voteData.votesRequired}\n` +
              `**Current Votes:** ${voteData.attendees.size}/${voteData.votesRequired}\n\n` +
              `This deployment will commence <t:${voteData.startTimestamp}:R>`
            );

          await message.edit({ embeds: [updatedEmbed] });
          return;
        }

        // View Attendance
        if (i.customId === 'deployment_view') {
          const list = voteData.attendees.size > 0
            ? [...voteData.attendees].map(id => `<@${id}>`).join('\n')
            : '_No operators have marked attendance yet._';

          await i.reply({
            content: `**Attendance List (${voteData.attendees.size}/${voteData.votesRequired})**\n${list}`,
            ephemeral: true,
          });
        }
      });

      // ── When timer expires: start or cancel ────────────
      collector.on('end', async () => {
        await message.delete().catch(() => {});

        const voteData = activeVotes.get(message.id);
        if (!voteData) return;

        activeVotes.delete(message.id);

        if (voteData.attendees.size >= voteData.votesRequired) {
          await triggerDeploymentStart(interaction.guild, voteData, channel, message);
        } else {
          const cancelEmbed = new EmbedBuilder()
            .setColor(config.embedColor)
            .setTitle('SWAT - Deployment Cancelled')
            .setDescription(
              `An insufficient amount of votes for the previous deployment has caused it to be cancelled. You will be notified for the next deployment vote when/if started.`
            )
            .setImage(config.embedImageUrl)
            .setFooter({ text: 'SWAT Deployment Cancelled' })
            .setTimestamp();

          await channel.send({ embeds: [cancelEmbed] });
        }
      });

      await interaction.reply({ content: `Deployment vote sent to <#${channel.id}>.`, ephemeral: true });
    }

    // ── /deployment end ───────────────────────────────────
    if (sub === 'end') {
      const channel = interaction.guild.channels.cache.get(config.channels.deploymentChannel);
      if (!channel) {
        return interaction.reply({ content: 'Deployment channel not found. Check config.js.', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });

      let deleted = 0;
      const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;

      while (true) {
        const fetched = await channel.messages.fetch({ limit: 100 });
        const deletable = fetched.filter(m => !m.pinned);

        if (deletable.size === 0) break;

        const bulkDeletable = deletable.filter(m => m.createdTimestamp > twoWeeksAgo);
        const tooOld = deletable.filter(m => m.createdTimestamp <= twoWeeksAgo);

        if (bulkDeletable.size >= 2) {
          const result = await channel.bulkDelete(bulkDeletable, true);
          deleted += result.size;
        } else if (bulkDeletable.size === 1) {
          await bulkDeletable.first().delete().catch(() => {});
          deleted++;
        }

        for (const msg of tooOld.values()) {
          await msg.delete().catch(() => {});
          deleted++;
        }

        if (fetched.size < 100) break;
      }

      const embed = new EmbedBuilder()
        .setColor(config.embedColor)
        .setTitle('SWAT - Deployment Ended')
        .setDescription(
          `The recent deployment has now concluded. If you missed this one, don't worry, deployments are hosted regularly throughout the week and you'll be notified of the next one. Thank you to all operators who attended the recent deployment.`
        )
        .setImage(config.embedImageUrl)
        .setFooter({ text: 'SWAT Deployment Ended' })
        .setTimestamp();

      await channel.send({ embeds: [embed] });
      await interaction.editReply({ content: `Deployment ended.` });
    }
  },
};

// ── Trigger Deployment Started embed ──────────────────────
async function triggerDeploymentStart(guild, voteData, channel, voteMessage) {
  const attendeeMentions = [...voteData.attendees].map(id => `<@${id}>`).join(' ');

  const embed = new EmbedBuilder()
    .setColor(config.embedColor)
    .setTitle('SWAT - Deployment Started')
    .setDescription(
      `A deployment has now commenced. All operators who marked their attendance to the deployment vote are now required to attend. Additional operatives may join regardless if they didn't mark their attendance.\n\n` +
      `Please make your way down to the briefing room with all gear and await further instructions from command.`
    )
    .setImage(config.embedImageUrl)
    .setFooter({ text: 'SWAT Deployment Started' })
    .setTimestamp();

  await channel.send({
    content: `<@&${config.roles.deploymentPingRole}> ${attendeeMentions}`,
    embeds: [embed],
  });
}
