import type { Channel, Client, GuildMember, Message, Role, Snowflake, User, } from 'discord.js';
import { Util, } from 'discord.js';

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

type SuccessfulParse<T> = [true, T, ];
type FailedParse<U extends Array<any>> = [false, ...U, ];
export type ParseResult<T, U extends Array<any>=[ ParseFailureReason, ]> = SuccessfulParse<T> | FailedParse<U>;

export type Parser<T> = (raw: string, _message: Message, _client: Client) => ParseResult<T>;
export type ParserSimple<T> = (raw: string, _message?: Message, _client?: Client) => ParseResult<T>;

export const fail = <U extends Array<any>>(...reason: U): ParseResult<any, U> => [ false, ...reason, ];
export const succeed = <T>(value: T): ParseResult<T> => [ true, value, ];

export const didSucceed = <T>(x: ParseResult<T>): x is SuccessfulParse<T> => x[0];

const map = <T, U>(x: ParseResult<T>, fn: (t: T) => U): ParseResult<U> => didSucceed(x) ? succeed(fn(x[1])) : x; // functor map
const andThen = <T, U>(x: ParseResult<T>, fn: (t: T) => ParseResult<U>): ParseResult<U> => didSucceed(x) ? fn(x[1]) : x; // monadic bind

// const chain = <T, U>(raw: string, _message: Message, _client: Client, parser1: Parser<T>, parser2: (t: T) => ParseResult<U>): ParseResult<U> =>
// 	andThen(parser1(raw, _message, _client), parser2);

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

const oneOfSimple = <T>(...parsers: ParserSimple<T>[]): ParserSimple<T> => {
	return function (x: string): ParseResult<T> {
		for (const parser of parsers) {
			const thisResult = parser(x);
			if (didSucceed(thisResult)) {
				return thisResult;
			}
		}
		return fail(ParseFailureReason.NO_PARSER_MATCHED);
	};
};

/* Implementations */

export const string: Parser<string> = (raw, _message) => succeed(Util.cleanContent(raw, _message));
export const number: ParserSimple<number> = raw => {
	const parsed = parseInt(raw, 10);
	return isNaN(parsed)
		? fail(ParseFailureReason.BAD_FORMAT)
		: succeed(parsed);
};
export const natural: ParserSimple<number> = raw =>
	andThen(
		number(raw),
		x => x < 0
			? fail(ParseFailureReason.BAD_VALUE)
			: succeed(x),
	);
export const nonNegative: ParserSimple<number> = raw =>
	andThen(
		number(raw),
		x => x <= 0
			? fail(ParseFailureReason.BAD_VALUE)
			: succeed(x),
	);

const escapeRegex = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const regexMatchMatcher = (regex: RegExp): ParserSimple<string> =>
	(raw: string): ParseResult<string> => { // matches something like <@id> (if prefix was @)
		const matchResult = raw.match(regex);
		if (matchResult === null) return fail(ParseFailureReason.BAD_FORMAT);
		const idAsString = matchResult[1];
		return succeed(idAsString);
	};

/**
 * Does not verify if the user actually exists. For that use `userReal`.
 */
const inlineIdMatcher = (includeRawId: boolean, ...prefixes: string[]): ParserSimple<Snowflake> => {
	const matchers = prefixes.map(prefix => regexMatchMatcher(new RegExp(`^<${escapeRegex(prefix)}(\\d+)>$`)));
	if (includeRawId) { matchers.push(regexMatchMatcher(/^(\d+)$/)); }
	return oneOfSimple(...matchers);
};

export const user = inlineIdMatcher(true, '@', '@!');
export const channel = inlineIdMatcher(true, '#');
export const role = inlineIdMatcher(true, '@&');

export const realUser = async (raw: string, message: Message, client: Client): Promise<ParseResult<User>> => {
	const userId = user(raw);
	if (!didSucceed(userId)) {
		return userId;
	} else {
		try {
			// I am hoping that defining it as a variable allows the catch clause to
			// trigger if the user isn't real...
			const user = await client.users.fetch(userId[1]);
			return succeed(user);
		} catch (e) {
			return fail(ParseFailureReason.BAD_VALUE);
		}
	}
};
export const realGuildUser = async (raw: string, message: Message): Promise<ParseResult<GuildMember>> => {
	const userId = user(raw);
	if (!didSucceed(userId)) {
		return userId;
	} else {
		try {
			if (message.guild === null) return fail(ParseFailureReason.NOT_APPLICABLE);
			// I am hoping that defining it as a variable allows the catch clause to
			// trigger if the user isn't real...
			const user = await message.guild.members.fetch(userId[1]);
			return succeed(user);
		} catch (e) {
			return fail(ParseFailureReason.BAD_VALUE);
		}
	}
};
export const realChannel = async (raw: string, _message: Message, client: Client): Promise<ParseResult<Channel>> => {
	const channelId = channel(raw);
	if (!didSucceed(channelId)) {
		return channelId;
	} else {
		try {
			// I am hoping that defining it as a variable allows the catch clause to
			// trigger if the channel isn't real...
			const channel = await client.channels.fetch(channelId[1]);
			return succeed(channel);
		} catch (e) {
			return fail(ParseFailureReason.BAD_VALUE);
		}
	}
};
export const realRole = async (raw: string, message: Message): Promise<ParseResult<Role>> => {
	const roleId = channel(raw);
	if (!didSucceed(roleId)) {
		return roleId;
	} else {
		try {
			if (message.guild === null) return fail(ParseFailureReason.NOT_APPLICABLE);
			// I am hoping that defining it as a variable allows the catch clause to
			// trigger if the role isn't real...
			const role = await message.guild.roles.fetch(roleId[1]);
			if (role === null) return fail(ParseFailureReason.BAD_VALUE);
			return succeed(role);
		} catch (e) {
			return fail(ParseFailureReason.BAD_VALUE);
		}
	}
};

export const raw: ParserSimple<string> = succeed;

const positiveWords = new Set([ 'y', 'yes', 'true', 'on', 'enabled', ]);
const negativeWords = new Set([ 'n', 'no', 'false', 'off', 'disabled', ]);

export const humanBoolean: ParserSimple<boolean> = raw => {
	const normalized = raw.normalize('NFKC').toLocaleLowerCase();
	if (positiveWords.has(normalized)) return succeed(true);
	if (negativeWords.has(normalized)) return succeed(false);
	return fail(ParseFailureReason.BAD_FORMAT);
};
