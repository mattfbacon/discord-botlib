export function invalidCommand(prefix: string, command: string): string {
	return `\`${command}\` is not a valid command. Try \`${prefix} help\` for a list.`;
}

export function prefixMessage(prefix: string, mentionAsPrefix: boolean): string {
	return `My prefix for this guild is \`${prefix}\`${mentionAsPrefix ? ', or you can mention me.' : ''}`;
}
