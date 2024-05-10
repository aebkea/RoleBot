import { PermissionsBitField } from 'discord.js';
import { SlashCommand } from '../../command';
import { SendSubCommand } from './send';

export class MessageBaseCommand extends SlashCommand {
    constructor() {
        super('message', 'Operate with messages.', [
            PermissionsBitField.Flags.Administrator,
        ]);

        this.addSubCommands([
            new SendSubCommand(this.name),
        ]);
    }
}