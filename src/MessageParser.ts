import type * as Discord from 'discord.js';
import type { CommandHandler, } from './Command';
import * as Util from './Util';
import * as Strings from './Strings';
import type * as DB from './Database';
import hooks from './Hooks/All';
import { runHooks, } from './Hook';
import config from './Config';

export class MessageParser {
	public readonly client: Discord.Client;
	public readonly db: DB.DBManager;
	public readonly commands: Map<string, CommandHandler>;

	protected readonly myMention: string;

	public constructor(db: DB.DBManager, client: Discord.Client, commands: Map<string, CommandHandler>) {
		this.client = client;
		this.db = db;
		this.commands = commands;
		this.myMention = Util.makeMention((client.user as Discord.ClientUser).id);
	}

	public run(message: Discord.Message, client: Discord.Client): void {
		const trimmedMessage = message.content.trim();
		const wasMentionAsPrefix = config.mentionAsPrefix && trimmedMessage.startsWith(this.myMention);
		if (wasMentionAsPrefix || trimmedMessage.startsWith(config.prefix)) {
			const [ command, ...args ] = trimmedMessage.slice((wasMentionAsPrefix ? this.myMention : config.prefix).length).trimStart().split(' ');
			if (wasMentionAsPrefix && command === '') {
				message.channel.send(Strings.prefixMessage);
				return;
			}
			const handler = this.commands.get(command);
			if (handler) {
				handler.run({ message, client, commands: this.commands, db: this.db, currentCommand: command, }, args);
			} else {
				this.invalidCommand(message, command, wasMentionAsPrefix);
			}
		}
	}

	protected invalidCommand(msg: Discord.Message, cmd: string, mentionAsPrefix: boolean): void {
		if (runHooks(hooks.onInvalidCommand, msg, cmd, mentionAsPrefix)) return;
		if (config.invalidCommandNotice[mentionAsPrefix ? 'mention' : 'prefix']) {
			msg.channel.send(Strings.invalidCommand(cmd), { allowedMentions: { parse: [], }, disableMentions: 'all', });
		}
	}
}
