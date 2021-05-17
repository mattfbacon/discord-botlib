import type * as Discord from 'discord.js';
import type { CommandHandler, } from './Command';
import * as Util from './Util';
import * as Strings from './Strings';
import type { Schema, } from './ConfigParser';
import type * as DB from './Database';

export class MessageParser {
	public readonly config: Schema;
	public readonly client: Discord.Client;
	public readonly db: DB.DBManager;
	public readonly commands: Map<string, CommandHandler>;

	protected readonly myMention: string;

	public constructor(config: Schema, db: DB.DBManager, client: Discord.Client, commands: Map<string, CommandHandler>) {
		this.config = config;
		this.client = client;
		this.db = db;
		this.commands = commands;
		this.myMention = Util.makeMention((client.user as Discord.ClientUser).id);
	}

	public run(message: Discord.Message, client: Discord.Client): void {
		const trimmedMessage = message.content.trim();
		if (trimmedMessage.startsWith(this.config.prefix)) {
			const [ command, ...args ] = trimmedMessage.slice(this.config.prefix.length).trimStart().split(' ');
			const handler = this.commands.get(command);
			if (handler) { // run the command
				handler.run({ message, client, commands: this.commands, config: this.config, db: this.db, currentCommand: command, }, args);
			} else { // tell the user the command was invalid
				this.invalidCommand(message.channel, command);
			}
		} else if (this.config.mentionAsPrefix && trimmedMessage.startsWith(this.myMention)) {
			const [ command, ...args ] = trimmedMessage.slice(this.myMention.length).trimStart().split(' ');
			if (command === '') {
				message.channel.send(Strings.prefixMessage(this.config.prefix, this.config.mentionAsPrefix));
			}
			const handler = this.commands.get(command);
			if (handler) { handler.run({ message, client, commands: this.commands, config: this.config, db: this.db, currentCommand: command, }, args); }
			// don't say anything if there is no command in order to not be annoying
			// if people are just talking about me.
		}
	}

	protected invalidCommand(chan: Discord.TextChannel | Discord.DMChannel | Discord.NewsChannel, cmd: string): void {
		chan.send(Strings.invalidCommand(this.config.prefix, cmd), { allowedMentions: { parse: [], }, disableMentions: 'all', });
	}
}
