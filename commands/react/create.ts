import { APIRole } from 'discord-api-types';
import {
  CommandInteraction,
  Interaction,
  MessageActionRow,
  MessageButton,
  MessageEmbed,
  Permissions,
  Role,
} from 'discord.js-light';
import RoleBot from '../../src/bot';
import {
  CREATE_REACT_ROLE,
  GET_REACT_ROLES_BY_GUILD,
  GET_REACT_ROLE_BY_EMOJI,
  GET_REACT_ROLE_BY_ROLE_ID,
} from '../../src/database/database';
import { ReactRoleType } from '../../src/database/entities/reactRole.entity';
import { CLIENT_ID } from '../../src/vars';
import { Category } from '../../utilities/types/commands';
import { SlashCommand } from '../slashCommand';
import emojiReg from 'emoji-regex';
import { handleInteractionReply } from '../../utilities/utils';

export class ReactRoleCommand extends SlashCommand {
  constructor(client: RoleBot) {
    super(
      client,
      'react-role',
      'Create a new react role. Give the command a role and an emoji. It really is that simple.',
      Category.react,
      [Permissions.FLAGS.MANAGE_ROLES]
    );

    this.addRoleOption('role', 'The role you want to use.', true);
    this.addStringOption('emoji', 'The emoji you want to use.', true);
  }

  emojiRegex = emojiReg();

  execute = async (interaction: CommandInteraction) => {
    if (!interaction.isCommand() || !interaction.guildId) return;

    const { guild } = interaction;
    if (!guild) return;

    const role = interaction.options.get('role')?.role;
    const [emoji] = this.extractStringVariables(interaction, 'emoji');

    if (!role || !emoji) {
      return handleInteractionReply(this.log, interaction, {
        ephemeral: true,
        content:
          'I had some issues finding that role or emoji. Please try again.',
      });
    }

    const reactRolesNotInCategory = (
      await GET_REACT_ROLES_BY_GUILD(guild.id)
    ).filter((r) => !r.categoryId).length;

    /**
     * Discord button row limitation is 5x5 so only a max of 25 buttons.
     */
    if (reactRolesNotInCategory >= 24) {
        return handleInteractionReply(this.log, interaction, `Hey! It turns out you have ${reactRolesNotInCategory} react roles not in a category.\nPlease add some react roles to a category before creating anymore. If however \`/category-add\` isn't responded please *remove* some react roles to get below 25 **not ina  category**. This is due to a Discord limitation!`);
    }

    const isValidPosition = await isValidRolePosition(interaction, role);

    if (!isValidPosition) {
      const embed = new MessageEmbed()
        .setTitle('Reaction Roles Setup')
        .setDescription(
          `The role <@&${role.id}> is above me in the role list which you can find in \`Server settings > Roles\`.\nPlease make sure that my role that is listed above the roles you want to assign.`
        );

      const button = new MessageActionRow().addComponents(
        new MessageButton()
          .setLabel('Discord Roles')
          .setURL(
            'https://support.discord.com/hc/en-us/articles/214836687-Role-Management-101'
          )
          .setStyle('LINK')
      );

      return interaction
        .reply({
          ephemeral: true,
          embeds: [embed],
          components: [button],
        })
        .catch((e) => this.log.error(`Interaction failed.\n${e}`, interaction.guildId));
    }

    // Custom emojis Look like this: <a?:name:id>
    const customEmoji = /(a?):\w+:(\d{17,19})/g.exec(emoji);

    // Default set the "emojiId" as the input. It's most likely just unicode.
    let emojiId = emoji;
    // I need this information for when the emoji is mentioned.
    let isEmojiAnimated = false;

    // This is only matched if a custom discord emoji was used.
    if (customEmoji) {
      /**
       * 0 - Matched regex
       * 1 - 'a' if it is animated. Otherwise it's empty.
       * 2 - ID
       */
      isEmojiAnimated = customEmoji[1] === 'a';
      emojiId = customEmoji[2];
    } else {
      const unicodeEmoji = emoji.match(this.emojiRegex);

      // Please make sure that no NON unicode emojis gets pass.
      if (!unicodeEmoji) {
        return handleInteractionReply(this.log, interaction, {
          ephemeral: true,
          content: `Hey! You didn't pass in a proper emoji. You need to either pass in a Discord emoji or a servers custom emoji.`,
        });
      }

      emojiId = unicodeEmoji[0];
    }

    if (!emojiId || emojiId === '') {
      this.log.error(
        `Failed to extract emoji[${emoji}] with regex from string.`,
        interaction.guildId
      );

      return handleInteractionReply(this.log, interaction, {
        ephemeral: true,
        content: `Hey! I had an issue trying to use that emoji. Please wait a moment and try again.`,
      });
    }

    /**
     * For now RoleBot doesn't allow two roles to share the same emoji.
     */
    let reactRole = await GET_REACT_ROLE_BY_EMOJI(emojiId, guild.id);

    if (reactRole) {
      const emojiMention = reactRole?.emojiTag ?? reactRole?.emojiId;

      return handleInteractionReply(this.log, interaction, {
        ephemeral: true,
        content: `The react role (${emojiMention} - <@&${reactRole.roleId}>) already has this emoji assigned to it.`,
      });
    }

    /**
     * Also check that the role isn't used already.
     */
    reactRole = await GET_REACT_ROLE_BY_ROLE_ID(role.id);

    if (reactRole) {
      const emojiMention = reactRole?.emojiTag ?? reactRole?.emojiId;
      return handleInteractionReply(this.log, interaction, {
        ephemeral: true,
        content: `There's a react role already using the role \`${reactRole.name}\` (${emojiMention} - <@&${reactRole.roleId}>).`,
      });
    }

    /* This is used when mentioning a custom emoji, otherwise it's unicode and doesn't have a custom ID. */
    const emojiTag = customEmoji
      ? `<${isEmojiAnimated ? 'a' : ''}:nn:${emojiId}>`
      : undefined;

    CREATE_REACT_ROLE(
      role.name,
      role.id,
      emojiId,
      emojiTag,
      interaction.guildId,
      ReactRoleType.normal
    )
      .then((reactRole) => {
        this.log.debug(
          `Successfully created the react role[${role.id}] with emoji[${emojiId}]`,
          interaction.guildId
        );

        const emojiMention = reactRole?.emojiTag ?? reactRole?.emojiId;

        handleInteractionReply(this.log, interaction, {
          ephemeral: true,
          content: `:tada: Successfully created the react role (${emojiMention} - <@&${role.id}>) :tada: \n**Make sure to add your newly created react role to a category with \`/category-add\`!**`,
        });
      })
      .catch((e) => {
        this.log.error(
          `Failed to create react role[${role.id}] | emoji[id: ${emojiId} : string: ${emoji}]\n${e}`,
          interaction.guildId
        );

        handleInteractionReply(this.log, interaction, {
          ephemeral: true,
          content: 'React role failed to create. Please try again.',
        });
      });
  };
}

/**
 * Check that RoleBot has a role above the one the user wants to hand out.
 * @returns true if the bot has a role above the users role.
 */
async function isValidRolePosition(
  interaction: Interaction,
  role: Role | APIRole
) {
  const clientUser = await interaction.guild?.members
    .fetch(CLIENT_ID)
    .catch(() => console.log(`Failed to fetch client user for guild.`));

  if (!clientUser) return false;

  return clientUser.roles.highest.position > role.position;
}
