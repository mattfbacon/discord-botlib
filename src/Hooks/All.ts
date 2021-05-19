import type { ClientEvents, Message, } from 'discord.js';

/**
 * The high-level goal of hooks is to promote aspect-oriented programming with
 * respect to the internal workings of the bot library, but without requiring
 * knowing those internal workings, and without having to edit the library code.
 *
 * In terms of library hooks (all other than `_internal`), if any of them
 * return true then the subsequent hooks will be skipped and the default action
 * will not be performed. For this reason, hooks should naturally be ordered by
 * priority, with more important hooks first due to their power over the
 * subsequent hooks.
 */
export interface Hooks {
	/**
	 * Allows the library user to add event handlers directly to the Discord.js
	 * `Client`. This provides a way to modify the functionality of the bot
	 * without editing library files.
	*/
	_internal: Map<keyof ClientEvents, Array<(...args: any[]) => any>>;
	/**
	 * The first thing that happens when a message is recieved, regardless of the
	 * sender (i.e., could be a message from the bot itself). Useful for blocking
	 * the processing of certain types of messages.
	 */
	beforeProcess: Array<(message: Message) => boolean>;
	/**
	 * After the message has been confirmed to not be from the bot, this hook is
	 * run before the parsing starts. This also works for blocking messages so
	 * it's your choice which to use based on whether you want the bot's messages
	 * to also be processed by the hook(s).
	 */
	beforeParse: Array<(message: Message) => boolean>;
	/**
	 * If the message parser throws an error, by default no feedback is given to
	 * the end user, and a message is logged to the terminal. This may not be
	 * desirable so this hook is provided.
	 */
	onParseThrow: Array<(message: Message, error: Error) => boolean>;
	/**
	 * After the message was determined to match the bot's prefix, but if the
	 * command was not found in the registered commands. Can be used to provide
	 * different information to the user, or just as a "default handler".
	 */
	onInvalidCommand: Array<(message: Message, command: string, mentionAsPrefix: boolean) => boolean>;
}

const allHooks: Partial<Hooks> = {};
export default allHooks;
