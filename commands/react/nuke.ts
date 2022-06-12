import {
  ButtonInteraction,
  CommandInteraction,
  MessageActionRow,
  MessageButton,
  Permissions,
} from 'discord.js-light';
import RoleBot from '../../src/bot';
import { DELETE_ALL_REACT_ROLES_BY_GUILD_ID } from '../../src/database/database';
import { Category } from '../../utilities/types/commands';
import { SlashCommand } from '../slashCommand';

export class ReactNukeCommand extends SlashCommand {
  constructor(client: RoleBot) {
    super(
      client,
      'react-nuke',
      'This will remove ALL react roles for this server.',
      Category.react,
      [Permissions.FLAGS.MANAGE_ROLES]
    );
  }

  handleButton = (interaction: ButtonInteraction) => {
    if (!interaction.guildId) {
      return interaction.followUp(
        `Hey! For some reason Discord didn't send me your guild info. No longer nuking.`
      );
    }

    interaction
      .followUp(
        `Okay well, you, ${
          interaction.member?.user || '[REDACTED]'
        } asked for all react-roles to be deleted.`
      )
      .catch((e) => this.log.error(`Interaction failed.\n${e}`));

    DELETE_ALL_REACT_ROLES_BY_GUILD_ID(interaction.guildId)
      .then(() => {
        this.log.debug(
          `User[${interaction.user.id}] removed ALL reactroles`,
          interaction.guildId
        );
        interaction
          .followUp(
            `Hey! I deleted all your react roles. Any categories you had should still stand.`
          )
          .catch(() => this.log.error(`Failed to send interaction followup`, interaction.guildId));
      })
      .catch((e) => {
        this.log.error(
          `Failed to delete reactroles\n${e}`,
          interaction.guildId
        );

        interaction
          .followUp(`Hey! I had an issue deleting all the react roles.`)
          .catch(() => this.log.error(`Failed to send interaction followup`, interaction.guildId));
      });
  };

  execute = (interaction: CommandInteraction) => {
    const buttons = new MessageActionRow().addComponents(
      new MessageButton()
        .setCustomId(`${this.name}_confirm`)
        .setLabel('Confirm Nuke')
        .setStyle('PRIMARY')
    );

    interaction.reply({
      ephemeral: true,
      components: [buttons],
      content: `ARE YOU SURE YOU WANT TO DELETE ALL YOUR REACT ROLES?`,
    });
  };
}
