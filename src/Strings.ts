import config from './Config';

export function invalidCommand(command: string): string {
	return `\`${command}\` is not a valid command. Try \`${config.prefix} help\` for a list.`;
}

export const prefixMessage = `My prefix for this guild is \`${config.prefix}\`${config.mentionAsPrefix ? ', or you can mention me.' : ''}`;

export function indexToString(idx: number): string {
	return config.zeroIndexed ? `idx ${idx}` : `#${idx}`;
}
