import * as Discord from 'discord.js';
import * as dotenv from 'dotenv';
dotenv.config();
import * as config from './vars';
import commandHandler from '../commands/commandHandler';
import joinRole from '../events/joinRoles';
import { guildUpdate } from '../events/guildUpdate';
import { BaseCommand } from '../utilities/types/commands';
import { IFolder, IFolderReactEmoji } from './interfaces';
import * as mongoose from 'mongoose';
import {
  GET_ALL_GUILD_PREFIXES,
  GET_ALL_JOIN_ROLES,
  GET_ALL_REACT_MESSAGES,
  GET_REACT_ROLE_BY_EMOJI,
} from './database/database';
import { LogService } from './services/logService';
import { SelectService } from './services/selectService';

export default class RoleBot extends Discord.Client {
  config: any;
  commandsRun: number;
  reactMessage: string[];
  commands: Discord.Collection<string, BaseCommand>;
  joinRoles: Discord.Collection<string, string[]>;
  guildFolders: Discord.Collection<string, IFolder[]>;
  reactChannel: Discord.Collection<string, Discord.Message>;
  folderContents: Discord.Collection<number, IFolderReactEmoji>;
  guildPrefix: Discord.Collection<string, string>;

  constructor() {
    super({
      partials: ['REACTION'],
      intents: [],
    });
    this.config = config;
    this.reactMessage = [];
    this.commandsRun = 0;

    this.commands = new Discord.Collection();
    this.reactChannel = new Discord.Collection();
    this.guildFolders = new Discord.Collection<string, IFolder[]>();
    this.folderContents = new Discord.Collection<number, IFolderReactEmoji>();
    this.joinRoles = new Discord.Collection<string, string[]>();
    this.guildPrefix = new Discord.Collection();

    this.on('ready', (): void => {
      LogService.setPrefix('BotReady');
      LogService.logDebug(`[Started]: ${new Date()}`);
      LogService.logOk(
        `RoleBot reporting for duty. Currently watching ${this.guilds.cache.size} guilds.`
      );

      setInterval(() => this.updatePresence(), 10000);
    });
    //this.on('message', (message): void => msg(this, message));

    this.on('interactionCreate', async (interaction) => {
      if (SelectService.isSelectMenu(interaction)) {
        SelectService.parseSelection(interaction, this);
      }

      if (!interaction.isCommand()) return;
      LogService.setPrefix('InteractionCreate');

      const command = this.commands.get(interaction.commandName);

      if (!command) return;

      try {
        await command.execute(interaction, this);
      } catch (error) {
        LogService.logError(
          `Encountered an error trying to run command[${command.name}] for guild[${interaction.guildId}]\n\t\t${error}\n`
        );

        await interaction.reply({
          content: 'There was an error while executing this command!',
          ephemeral: true,
        });
      }
    });

    this.on('guildMemberAdd', (member) => joinRole(member, this.joinRoles));
    this.on('guildCreate', (guild): void => guildUpdate(guild, 'Joined', this));
    this.on('guildDelete', (guild): void => guildUpdate(guild, 'Left', this));
    // React role handling
    this.on('messageReactionAdd', (...r) => {
      this.handleReaction(...r, 'add');
    });
    this.on('messageReactionRemove', (...r) => {
      this.handleReaction(...r, 'remove');
    });
    /**
     * Whenever roles get deleted or changed let's update RoleBots DB.
     * Remove roles deleted and update role names.
     */
    //this.on('roleDelete', (role) => roleDelete(role, this));
    //this.on('roleUpdate', (...r) => roleUpdate(...r, this));
  }

  private updatePresence = () => {
    if (!this.user)
      return LogService.logError(
        `Can't set presence due to client user missing.`
      );

    this.user.setPresence({
      activities: [
        {
          name: 'rb help',
          type: 'WATCHING',
        },
      ],
      status: 'dnd',
    });
  };

  private handleReaction = async (
    reaction: Discord.MessageReaction | Discord.PartialMessageReaction,
    user: Discord.User | Discord.PartialUser,
    type: 'add' | 'remove'
  ) => {
    try {
      LogService.setPrefix('HandleReaction');

      if (!reaction || user.bot) return;
      const { message, emoji } = reaction;
      const { guild } = message;
      if (this.reactMessage.includes(message.id) && guild) {
        const emojiId = emoji.id || emoji.name;

        if (!emojiId) {
          return LogService.logError(
            `Couldn't get emoji ID from reaction event.`
          );
        }

        const reactRole = await GET_REACT_ROLE_BY_EMOJI(emojiId, guild.id);

        // Remove reaction since it doesn't exist.
        if (!reactRole && type === 'add') {
          return reaction.users.remove(user.id).catch(LogService.logError);
        } else if (!reactRole) {
          return;
        }

        const role = guild.roles.cache.get(reactRole.roleId);
        let member = guild.members.cache.get(user.id);

        if (!member) {
          LogService.logInfo(
            `Role ${type} - Failed to get member from cache. Going to fetch and retry.... guild[${guild.id}] - user[${user.id}]`
          );
          await guild.members.fetch(user.id);
          member = guild.members.cache.get(user.id);
          LogService.logInfo(
            `Did member fectch successfully?. Does member exist: ${!!member}`
          );
        }

        if (!role) {
          return LogService.logError(
            `Could not find GuildRole from stored ReactRole: roleID[${reactRole.id}]. Possibly deleted.`
          );
        } else if (!member) {
          return LogService.logError(
            `Could not find GuildMember from ReactionUser: username[${user.username}] | ID[${user.id}]`
          );
        }

        switch (type) {
          case 'add':
            member.roles
              .add(role)
              .catch(() =>
                LogService.logError(
                  `Error issuing role[${role.id}] to user[${member?.id}]. Perhaps a permission issue.`
                )
              );
            break;
          case 'remove':
            member.roles
              .remove(role)
              .catch(() =>
                LogService.logError(
                  `Error removing role[${role.id}] from user[${member?.id}]. Perhaps a permission issue.`
                )
              );
        }
      }
    } catch (e) {
      LogService.logError(
        `Error thrown when tryingg to [${type}] a reaction role to user.`
      );
    }
  };

  private async loadReactMessageIds(): Promise<void> {
    const messages = await GET_ALL_REACT_MESSAGES();
    this.reactMessage = messages.map((m) => m.messageId);
  }

  private async loadGuildJoinRoles(): Promise<void> {
    const guilds = await GET_ALL_JOIN_ROLES();

    for (const g of guilds) {
      this.joinRoles.set(g.guildId, g.joinRoles);
    }
  }

  private async loadGuildPrefixes(): Promise<void> {
    const guilds = await GET_ALL_GUILD_PREFIXES();

    for (const g of guilds) {
      this.guildPrefix.set(g.guildId, g.prefix || 'rb');
    }
  }

  public start = async () => {
    LogService.setPrefix('BotStart');

    LogService.logInfo(`Connecting to MONGODB: ${config.DATABASE_TYPE}`);
    await mongoose.connect(`mongodb://localhost/rolebotBeta`);

    LogService.logInfo(`Connecting to Discord with bot token.`);
    await this.login(this.config.TOKEN);
    LogService.logInfo('Bot connected.');

    // Slash commands can only load once the bot is connected?
    commandHandler(this);

    LogService.setPrefix('BotStart');
    LogService.logInfo(
      `Loading basic data.\n\t\t- Guild auto-join roles\n\t\t- Message IDs\n\t\t- Prefixes`
    );
    await Promise.all([
      this.loadGuildJoinRoles(),
      this.loadReactMessageIds(),
      this.loadGuildPrefixes(),
    ]);

    LogService.logOk(`Successfully loaded all data and logged in.`);
  };
}
