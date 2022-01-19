import { CommandInteraction, Permissions } from 'discord.js';
import RoleBot from '../../src/bot';
import { Category } from '../../utilities/types/commands';
import { SlashCommand } from '../slashCommand';

export class AutoJoinCommand extends SlashCommand {
  constructor(client: RoleBot) {
    super(
      client,
      'auto-join',
      'Setup auto join roles for the server.',
      Category.general,
      [Permissions.FLAGS.MANAGE_ROLES]
    );

    // Sigh figure out how to add all this shit.
    /**
     * .addSubcommandGroup((subCommandGroup) =>
      subCommandGroup
        .setName('role')
        .setDescription('Add, remove or list all your auto-join roles.')
        .addSubcommand((command) =>
          command
            .setName('add')
            .setDescription('Add a role to your auto-join roles.')
            .addRoleOption((option) =>
              option
                .setName('join-role')
                .setDescription(
                  'Users will get this role when they join your server.'
                )
                .setRequired(true)
            )
        )
        .addSubcommand((command) =>
          command
            .setName('remove')
            .setDescription('Remove an auto join role from your list.')
        )
        .addSubcommand((command) =>
          command
            .setName('list')
            .setDescription('See all your auto join roles.')
        )
    )
     */
  }

  execute = (interaction: CommandInteraction) => {
    interaction
      .reply({
        ephemeral: true,
        content: `Hey! This command is currently under development to work with the new slash command style. Thank you for being patient.`,
      })
      .catch((e) => {
        this.log.error(`Interaction failed.`);
        this.log.error(`${e}`);
      });
  };
}