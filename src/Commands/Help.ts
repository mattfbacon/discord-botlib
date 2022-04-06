import type { EmbedFieldData, } from 'discord.js';
import { MessageEmbed, } from 'discord.js';
import type { ArgumentHandler, CommandContext, ArgType, } from '../Command';
import { ArgKind, } from '../Command';
import { CommandHandler, OptionalArgumentHandler, } from '../Command';
import { getProperty, } from '../Util';
import * as Strings from '../Strings';
import config from '../Config';
import * as Parsers from '../Parsers';

function commandShortDesc({ metadata: { name, shortDesc, }, args, }: CommandHandler): string {
	return `${name} ${args.map(getProperty('repr')).join(' ')}: ${shortDesc}`;
}

const typeKindKindWrapper: Record<ArgKind, (x: string) => string> = Object.create({
	[ArgKind.REQUIRED]: (x: string) => x,
	[ArgKind.OPTIONAL]: (x: string) => `${x}?`,
	[ArgKind.REST]: (x: string) => `...${x}`,
});

const typeKindRepr = (type: ArgType, kind: ArgKind): string => typeKindKindWrapper[kind](type.type ?? type.name);

const argToEmbedField = ({ metadata: { name, shortDesc, longDesc, }, type, kind, }: ArgumentHandler): EmbedFieldData => ({
	name: `${name}: ${typeKindRepr(type, kind)}`,
	value: shortLongDesc(shortDesc, longDesc),
});

const shortLongDesc = (shortDesc: string, longDesc?: string): string => `${shortDesc}${longDesc ? `\n${longDesc}` : ''}`;

export async function help({ message, commands, client, }: CommandContext, name_?: string): Promise<void> {
	if (name_) {
		const commandData = commands.get(name_);
		if (commandData) {
			const { metadata: { name, shortDesc, longDesc, }, args, } = commandData;
			await message.channel.send({ embeds: [ new MessageEmbed({
				title: `Help for \`${name}\``,
				description: shortLongDesc(shortDesc, longDesc),
				fields: args.map(argToEmbedField),
				color: config.themeColor,
			}) ]});
		} else {
			await message.channel.send({ content: Strings.invalidCommand(name_), allowedMentions: { parse: [], } });
		}
	} else {
		await Promise.all(Array.from(commands.values()).map(commandShortDesc).map((x: string) => message.channel.send(`\`${x}\``)));
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
		new OptionalArgumentHandler(Parsers.string, {
			name: "command",
			shortDesc: "The command to get help for",
			longDesc: "If provided, give information about the command. If not, give a list of commands.",
		}),
	],
	null, // rest arg
);
