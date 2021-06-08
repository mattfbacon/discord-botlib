import type { Channel, Client, GuildMember, Message, Role, Snowflake, User, } from 'discord.js';
import { Util, DiscordAPIError, } from 'discord.js';
import type { CommandContext, } from './Command';

/* Lib */

export const enum ParseFailureReason {
	/**
	 * Could not be parsed due to improper format
	 */
	BAD_FORMAT,
	/**
	 * Could be parsed but the value was invalid
	 */
	BAD_VALUE,
	/**
	 * Multiple parsers existed for the value but none of them succeeded
	 */
	NO_PARSER_MATCHED,
	/**
	 * Tried to get something that makes no sense in the context
	 * (e.g., GuildMember in a DM)
	 */
	NOT_APPLICABLE,
	VALUE_REQUIRED,
}

type SuccessfulParse<T> = T;
type FailedParse<U extends Array<any>> = U;
// can't type the rejection of a Promise so we'll do it the JS way...
type ParseResult<T> = Promise<SuccessfulParse<T>>;

type PossiblyPartial<T, IsPartial extends boolean> = IsPartial extends true ? Partial<T> : T;

type _Parser<T, IsSimple extends boolean> = (raw: string, context: PossiblyPartial<CommandContext, IsSimple>) => ParseResult<T>;
/**
 * if `type` is not defined, then use the `Function#name`.
 */
export type Parser<T, IsSimple extends boolean> = _Parser<T, IsSimple> & { type?: string };

// const oneOf = <T>(...parsers: Parser<T>[]): Parser<T> => {
// 	return function (x, _message, _client): ParseResult<T> {
// 		for (const parser of parsers) {
// 			const thisResult = parser(x, _message, _client);
// 			if (didSucceed(thisResult)) {
// 				return thisResult;
// 			}
// 		}
// 		return fail(ParseFailureReason.NO_PARSER_MATCHED);
// 	};
// };

const oneOf = <T, IsSimple extends boolean>(...parsers: Parser<T, IsSimple>[]): Parser<T, IsSimple> =>
	(raw, context): ParseResult<T> =>
		Promise.any(parsers.map(parser => parser(raw, context)));

/* Implementations */

export const string: Parser<string, false> = async (raw, { message, }) => { return Util.cleanContent(raw, message); };
string.type = "text";
export const number: Parser<number, true> = async raw => {
	const parsed = parseInt(raw, 10);
	if (isNaN(parsed)) { throw ParseFailureReason.BAD_FORMAT; }
	return parsed;
};

export const withCondition = <T, IsSimple extends boolean = false>(parser: Parser<T, IsSimple>, pred: (x: T) => boolean): Parser<T, IsSimple> =>
	async (raw, context): ParseResult<T> => {
		const x = await parser(raw, context);
		if (pred(x)) {
			return x;
		} else {
			throw ParseFailureReason.BAD_VALUE;
		}
	};
export const natural = withCondition(number, x => x >= 0);
export const nonNegative = withCondition(number, x => x > 0);
nonNegative.type = "non-negative";

const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const regexMatchMatcher = (regex: RegExp): Parser<string, true> =>
	async (raw: string): ParseResult<string> => { // matches something like <@id> (if prefix was @)
		const matchResult = raw.match(regex);
		if (matchResult === null) { throw ParseFailureReason.BAD_FORMAT; }
		const idAsString = matchResult[1];
		return idAsString;
	};

/**
 * Does not verify if the user actually exists. For that use `userReal`.
 */
const inlineIdMatcher = (includeRawId: boolean, ...prefixes: string[]): Parser<Snowflake, true> => {
	const matchers = prefixes.map(prefix => regexMatchMatcher(new RegExp(`^<${escapeRegex(prefix)}(\\d+)>$`)));
	if (includeRawId) { matchers.push(regexMatchMatcher(/^(\d+)$/)); }
	return oneOf(...matchers);
};

export const user = inlineIdMatcher(true, '@', '@!');
export const channel = inlineIdMatcher(true, '#');
export const role = inlineIdMatcher(true, '@&');

export const realUser: Parser<User, false> = async (raw: string, context) => {
	const userId = await user(raw, context);
	try {
		// I am hoping that defining it as a variable allows the catch clause to
		// trigger if the user isn't real...
		const user = await context.client.users.fetch(userId[1]);
		return user;
	} catch (e) {
		if (e instanceof DiscordAPIError) {
			throw ParseFailureReason.BAD_VALUE;
		} else {
			throw e;
		}
	}
};
export const realGuildUser: Parser<GuildMember, false> = async (raw: string, context) => {
	const userId = await user(raw, context);
	try {
		if (context.message.guild === null) { throw ParseFailureReason.NOT_APPLICABLE; }
		// I am hoping that defining it as a variable allows the catch clause to
		// trigger if the user isn't real...
		const user = await context.message.guild.members.fetch(userId[1]);
		return user;
	} catch (e) {
		if (e instanceof DiscordAPIError) {
			throw ParseFailureReason.BAD_VALUE;
		} else {
			throw e;
		}
	}
};
export const realChannel: Parser<Channel, false> = async (raw: string, context) => {
	const channelId = await channel(raw, context);
	try {
		// I am hoping that defining it as a variable allows the catch clause to
		// trigger if the channel isn't real...
		const channel = await context.client.channels.fetch(channelId[1]);
		return channel;
	} catch (e) {
		if (e instanceof DiscordAPIError) {
			throw ParseFailureReason.BAD_VALUE;
		} else {
			throw e;
		}
	}
};
export const realRole: Parser<Role, false> = async (raw: string, context) => {
	const roleId = await role(raw, context);
	try {
		if (context.message.guild === null) { throw ParseFailureReason.NOT_APPLICABLE; }
		// I am hoping that defining it as a variable allows the catch clause to
		// trigger if the role isn't real...
		const role = await context.message.guild.roles.fetch(roleId[1]);
		if (role === null) { throw ParseFailureReason.BAD_VALUE; }
		return role;
	} catch (e) {
		if (e instanceof DiscordAPIError) {
			throw ParseFailureReason.BAD_VALUE;
		} else {
			throw e;
		}
	}
};

export const raw: Parser<string, true> = async x => x;

const positiveWords = new Set([ 'y', 'yes', 'true', 'on', 'enabled', ]);
const negativeWords = new Set([ 'n', 'no', 'false', 'off', 'disabled', ]);

export const humanBoolean: Parser<boolean, true> = async raw => {
	const normalized = raw.normalize('NFKC').toLocaleLowerCase();
	if (positiveWords.has(normalized)) return true;
	if (negativeWords.has(normalized)) return false;
	throw ParseFailureReason.BAD_FORMAT;
};
