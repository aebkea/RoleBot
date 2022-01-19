import { CommandInteraction, Permissions } from 'discord.js';
import RoleBot from '../../src/bot';
import {
  DELETE_REACT_ROLE_BY_ROLE_ID,
  GET_REACT_ROLE_BY_ROLE_ID,
} from '../../src/database/database';
import {
  ReactMessageUpdate,
  updateReactMessages,
} from '../../utilities/functions/reactions';
import { Category } from '../../utilities/types/commands';
import { SlashCommand } from '../slashCommand';

export class ReactDeleteCommand extends SlashCommand {
  constructor(client: RoleBot) {
    super(
      client,
      'react-remove',
      'Remove an existing reaction role from a drop down menu.',
      Category.react,
      [Permissions.FLAGS.MANAGE_ROLES]
    );

    this.addRoleOption('role', `The reaction role you want to remove.`, true);
  }

  execute = async (interaction: CommandInteraction) => {
    const role = interaction.options.get('role')?.role;

    if (!role) {
      this.log.error(
        `Interaction was missing role property despite it being required.`
      );

      return interaction
        .reply({
          ephemeral: true,
          content: `Hey! For some reason I was unable to get the role that you told me to delete. Is it already deleted? Please try again. :)`,
        })
        .catch((e) => {
          this.log.error(`Interaction failed.`);
          this.log.error(`${e}`);
        });
    }

    const reactRole = await GET_REACT_ROLE_BY_ROLE_ID(role.id);

    if (!reactRole) {
      this.log.debug(
        `User passed in role[${role.id}] that isn't in guilds reactRoles list.`
      );

      return interaction
        .reply({
          ephemeral: true,
          content: `Hey! That role isn't in my system, perhaps you meant to pass in a different role?`,
        })
        .catch((e) => {
          this.log.error(`Interaction failed.`);
          this.log.error(`${e}`);
        });
    }

    try {
      await DELETE_REACT_ROLE_BY_ROLE_ID(role.id);

      this.log.debug(
        `Successfully removed guilds[${interaction.guildId}] react role[${role.id}]`
      );

      const emojiMention =
        reactRole.emojiId.length > 15
          ? `<:n:${reactRole.emojiId}>`
          : reactRole.emojiId;

      interaction
        .reply({
          ephemeral: true,
          content: `I successfully removed the react role (${emojiMention} - <@&${role.id}>)! You can add it back at any time if you wish.\n\nI'm gonna do some cleanup now and update any react role embed...`,
        })
        .catch((e) => {
          this.log.error(`Interaction failed.`);
          this.log.error(`${e}`);
        });

      // Only update react message if there's a category associated with it.
      if (reactRole.categoryId) {
        updateReactMessages(
          this.client,
          reactRole.categoryId,
          this.log,
          ReactMessageUpdate.reactRoleRemove
        );
      }
    } catch (e) {
      this.log.error(
        `Error'd when trying to delete react role[${role.id}] on guild[${interaction.guildId}]`
      );
      this.log.critical(`${e}`);

      interaction
        .reply({
          ephemeral: true,
          content: `Hey! I had an issue deleting that react role. Please wait a moment and try again.`,
        })
        .catch((e) => {
          this.log.error(`Interaction failed.`);
          this.log.error(`${e}`);
        });
    }
  };
}