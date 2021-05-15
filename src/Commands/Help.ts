import type { EmbedFieldData, } from 'discord.js';
import { MessageEmbed, } from 'discord.js';
import type { ArgumentHandler, CommandContext, } from '../Command';
import { ArgKind, } from '../Command';
import { ArgType, CommandHandler, OptionalArgumentHandler, } from '../Command';
import { getProperty, } from '../Util';
import * as Strings from '../Strings';

function commandShortDesc({ metadata: { name, shortDesc, }, args, }: CommandHandler): string {
	return `${name} ${args.map(getProperty('repr')).join(' ')}: ${shortDesc}`;
}

const typeKindKindWrapper: Record<ArgKind, (x: string) => string> = Object.create({
	[ArgKind.REQUIRED]: (x: string) => x,
	[ArgKind.OPTIONAL]: (x: string) => `${x}?`,
	[ArgKind.REST]: (x: string) => `...${x}`,
});

const typeKindRepr = (type: ArgType, kind: ArgKind): string => typeKindKindWrapper[kind](type);

const argToEmbedField = ({ metadata: { name, shortDesc, longDesc, }, type, kind, }: ArgumentHandler): EmbedFieldData => ({
	name: `${name}: ${typeKindRepr(type, kind)}`,
	value: shortLongDesc(shortDesc, longDesc),
});

const shortLongDesc = (shortDesc: string, longDesc: string): string => `${shortDesc}${longDesc ? `\n${longDesc}` : ''}`;

function help({ message, commands, config: { prefix, themeColor, }, }: CommandContext, name_?: string): void {
	if (name_) {
		const commandData = commands.get(name_);
		if (commandData) {
			const { metadata: { name, shortDesc, longDesc, }, args, } = commandData;
			message.channel.send(new MessageEmbed({
				title: `Help for \`${name}\``,
				description: shortLongDesc(shortDesc, longDesc),
				fields: args.map(argToEmbedField),
				color: themeColor,
			}));
		} else {
			message.channel.send(Strings.invalidCommand(prefix, name_));
		}
	} else {
		message.channel.send([
			'```',
			...Array.from(commands.values()).map(commandShortDesc),
			'```',
		].join('\n'));
	}
}

export default CommandHandler.makeFromHandlerAndArgs(
	help, // handler
	{
		name: "help",
		shortDesc: "Get help using the bot",
		longDesc: "",
	},
	[], // static args
	[ // optional args
		new OptionalArgumentHandler(ArgType.STRING, {
			name: "command",
			shortDesc: "The command to get help for",
			longDesc: "If provided, give information about the command. If not, give a list of commands.",
		}),
	],
	null // rest arg
);
