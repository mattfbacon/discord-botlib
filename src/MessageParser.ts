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
	public readonly db: DB.IDBManager;
	public readonly commands: Map<string, CommandHandler>;

	protected readonly myMentions: string[];

	public constructor(db: DB.IDBManager, client: Discord.Client, commands: Map<string, CommandHandler>) {
		this.client = client;
		this.db = db;
		this.commands = commands;
		const id = (client.user as Discord.ClientUser).id;
		this.myMentions = [ Util.makeMention(id), Util.makeNicknameMention(id), ];
	}

	public run(message: Discord.Message, client: Discord.Client): void {
		const trimmedMessage = message.content.trim();
		const mentionAsPrefixPrefix: string | undefined = config.mentionAsPrefix
			? this.myMentions.find(x => trimmedMessage.startsWith(x))
			: void 0;
		if (!!mentionAsPrefixPrefix || trimmedMessage.startsWith(config.prefix)) {
			const [ command, ...args ] = trimmedMessage.slice((mentionAsPrefixPrefix ?? config.prefix).length).trimStart().split(' ');
			if (!!mentionAsPrefixPrefix && command === '') {
				message.channel.send(Strings.prefixMessage);
				return;
			}
			const handler = this.commands.get(command);
			if (handler) {
				handler.run({ message, client, commands: this.commands, db: this.db, currentCommand: command, }, args);
			} else {
				this.invalidCommand(message, command, !!mentionAsPrefixPrefix);
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
