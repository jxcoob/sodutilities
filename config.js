//        SOD Utilities Config
require('dotenv').config();

module.exports = {

  // ── Bot Settings ──────────────────────────────────────────
  token: process.env.BOT_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,

  // ── Prefix ────────────────────────────────────────────────
  prefix: '-',

  // ── Branding ──────────────────────────────────────────────
  embedColor: '#000000',
  embedImageUrl: 'https://cdn.discordapp.com/attachments/1493292780250988654/1493298316711166203/footer.png?ex=69de75ee&is=69dd246e&hm=1efbad08162b07bd4e67620ecc90f740d0ec32fa4ac76413726b15ab9920f111&animated=true',

  // ── Roles ──────────────────────────────────────────────────
  roles: {
    // Role that gets pinged on deployment vote & deployment start
    deploymentPingRole: '1461900200871333929',

    // Roles allowed to run /deployment vote and /deployment end
    deploymentCommandRoles: [
      '1493707262014001283',
      '1461900994509148200',
    ],

    // Role allowed to use all prefix commands (-say, -dm, -purge, etc.)
    prefixCommandRole: '1493707262014001283',

    // Role removed from a user when -employ is used
    employmentRemoveRole: '1468011914708783167',

    // Roles given to a user when -employ is used
    employmentRoles: [
      '1493706715928068227',
      '1493706473191244007',
      '1461901063862091837',
    ],

    // Roles that -remove will strip from a user (and -restore will give back)
    removableRoles: [
      '1493706715928068227',
      '1493706473191244007',
      '1461900200871333929',
      '1461900994509148200',
      '1461901063862091837',
      '1468011914708783167',
    ],
  },

  // ── Channels ──────────────────────────────────────────────
  channels: {
    // Channel where deployment embeds are sent
    deploymentChannel: '1462173424226144469',
  },

};