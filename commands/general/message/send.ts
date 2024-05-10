import {
  ApplicationCommandOptionType,
  Channel,
  ChannelType,
  ChatInputCommandInteraction,
  Colors,
  EmbedBuilder,
  TextChannel,
} from 'discord.js';
import { SlashSubCommand } from '../../command';
import { requiredPermissions } from '../../../utilities/utilErrorMessages';

const enum CommandOptionNames {
  MessageLink = 'message-link',
}

export class SendSubCommand extends SlashSubCommand {
  constructor(baseCommand: string) {
    super(baseCommand, 'send', `Send a message via the bot!`, [
      {
        name: CommandOptionNames.MessageLink,
        description: 'The link to the message to copy.',
        type: ApplicationCommandOptionType.String,
        required: true,
      },
    ]);
  }

  execute = async (interaction: ChatInputCommandInteraction) => {
    if (!interaction.guildId) {
      return this.log.error(`GuildID did not exist on interaction.`);
    }

    const { guildId } = interaction;

    await interaction.deferReply({
      ephemeral: true,
    });

    const messageLink = this.expect(
      interaction.options.getString(CommandOptionNames.MessageLink),
      {
        message:
          'Make sure to pass the message link by right click copying it on desktop!',
        prop: 'message-link',
      },
    );

    const [_, channelId, messageId] = messageLink.match(/\d+/g) ?? [];

    const channel = await interaction.guild?.channels
      .fetch(channelId)
      .catch((e) =>
        this.log.debug(`Failed to find channel[${channelId}]\n${e}`, guildId),
      );

    if (!channel || !isTextChannel(channel)) {
      return interaction.editReply(
        `Hey! I couldn't find that channel, make sure you're copying the message link right.`,
      );
    }

    const permissionsError = requiredPermissions(channel.id);

    const message = await channel.messages
      .fetch(messageId)
      .catch((e) =>
        this.log.info(`Failed to fetch message[${messageId}]\n${e}`),
      );

    if (!message) {
      return interaction.editReply(permissionsError);
    }

    interaction.channel?.send(message.content)
      .then(() => {
        interaction.editReply(`Message sent!`);
      })
      .catch((e) => {
        this.log.error(`Failed to send message.\n${e}`);
        interaction.editReply(`Failed to send message.`);
      });
  }
}

function isTextChannel(channel: Channel): channel is TextChannel {
  return channel.type === ChannelType.GuildText;
}