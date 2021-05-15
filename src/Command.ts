import type * as Discord from 'discord.js';
import type { Schema, } from './ConfigParser';
import * as Parsers from './Parsers';
import type { ParseResult, } from './Parsers';
import type { DBManager, } from './Database';

export const enum ArgKind {
	REQUIRED,
	OPTIONAL,
	REST,
}

export const enum ArgType {
	STRING = 'text',
	NUMBER = 'number',
	NATURAL = 'natural',
	NON_NEGATIVE = 'non-negative',
	USER = 'user',
	ROLE = 'role',
	CHANNEL = 'channel',
	RAW = 'text!',
	BOOLEAN = 'bool',
}

export const parserForArgType: Record<string, Parsers.Parser<any>> = Object.create({
	[ArgType.STRING]: Parsers.string,
	[ArgType.NUMBER]: Parsers.number,
	[ArgType.NATURAL]: Parsers.natural,
	[ArgType.NON_NEGATIVE]: Parsers.nonNegative,
	[ArgType.USER]: Parsers.realUser,
	[ArgType.ROLE]: Parsers.realRole,
	[ArgType.CHANNEL]: Parsers.realChannel,
	[ArgType.RAW]: Parsers.raw,
	[ArgType.BOOLEAN]: Parsers.humanBoolean,
});

export interface CommandContext {
	message: Discord.Message;
	client: Discord.Client;
	// eslint-disable-next-line no-use-before-define
	commands: Map<string, CommandHandler>;
	config: Schema;
	db: DBManager;
}

export interface Metadata {
	name: string;
	shortDesc: string;
	longDesc: string;
}

type AnyReasonable = string | number | boolean | null | undefined | Array<any> | Record<any, any>;

export class ArgumentHandler {
	public readonly getFrom: (args: string[], context: CommandContext) => [ParseResult<AnyReasonable[]>, string[], ];
	public readonly metadata: Metadata;
	public readonly kind: ArgKind;
	public readonly type: ArgType;
	// -1 if `kind` is rest; max if `kind` is optional
	public readonly argsTaken: number;

	public readonly repr: string;

	public constructor(
		getFrom: (args: string[], context: CommandContext) => [ ParseResult<AnyReasonable[]>, string[], ],
		metadata: Metadata,
		kind: ArgKind,
		type: ArgType,
		argsTaken: number
	) {
		this.getFrom = getFrom;
		this.metadata = metadata;
		this.kind = kind;
		this.type = type;
		this.argsTaken = argsTaken;

		this.repr = kindWrapper[this.kind](`${this.metadata.name}: ${this.type}`);
	}
}

export class StaticArgumentHandler extends ArgumentHandler {
	public constructor(type: ArgType, metadata: Metadata) {
		const argHandler = parserForArgType[type];
		super((args, context) => {
			if (args.length < 1) return [ Parsers.fail(Parsers.ParseFailureReason.VALUE_REQUIRED), args.slice(1), ];
			const parseResult = argHandler(args[0], context.message, context.client);
			if (!Parsers.didSucceed(parseResult)) {
				return [ parseResult, args.slice(1), ];
			}
			return [ Parsers.succeed([ parseResult[1], ]), args.slice(1), ];
		}, metadata, ArgKind.REQUIRED, type, 1);
	}
}

export class OptionalArgumentHandler extends ArgumentHandler {
	public constructor(type: ArgType, metadata: Metadata) {
		const argHandler = parserForArgType[type];
		super((args, context) => {
			if (args.length < 1) return [ Parsers.succeed([ void 0, ]), args.slice(1), ];
			const parseResult = argHandler(args[0], context.message, context.client);
			if (!Parsers.didSucceed(parseResult)) {
				return [ parseResult, args.slice(1), ];
			}
			return [ Parsers.succeed([ parseResult[1], ]), args.slice(1), ];
		}, metadata, ArgKind.OPTIONAL, type, 1);
	}
}

export class RestArgumentHandler extends ArgumentHandler {
	public constructor(type: ArgType, metadata: Metadata) {
		const argHandler = parserForArgType[type];
		super((args, context) => {
			const parsedArgs: AnyReasonable[] = [];
			for (const [ i, arg, ] of args.entries()) {
				const thisParsedArg = argHandler(arg, context.message, context.client);
				if (!Parsers.didSucceed(thisParsedArg)) return [ thisParsedArg, args.slice(i + 1), ];
				parsedArgs.push(thisParsedArg[1]);
			}
			return [ Parsers.succeed(parsedArgs), [], ];
		}, metadata, ArgKind.REST, type, -1);
	}
}

const kindWrapper: Record<ArgKind, (x: string) => string> = {
	[ArgKind.REQUIRED]: x => `<${x}>`,
	[ArgKind.OPTIONAL]: x => `[${x}]`,
	[ArgKind.REST]: x => `[${x} ...]`,
};

const enum ArgumentFailureReason {
	REQUIRED_NOT_PROVIDED,
	EXCESS,
	PARSE_BAD,
}

type ArgumentFailure =
	[ArgumentFailureReason.EXCESS, number, ] | // number of extra args left after parsing
	[ArgumentFailureReason.PARSE_BAD, number, Metadata, Parsers.ParseFailureReason, ]; // index, reason

export class CommandHandler {
	public readonly args: ArgumentHandler[];
	public readonly minArgs: number;
	public readonly metadata: Metadata;
	protected readonly utopicRun: (context: CommandContext, ...xs: AnyReasonable[]) => any;

	public constructor(utopicRun: (context: CommandContext, ...xs: AnyReasonable[]) => any, args: ArgumentHandler[], minArgs: number, metadata: Metadata) {
		this.utopicRun = utopicRun;
		this.args = args;
		this.minArgs = minArgs;
		this.metadata = metadata;
	}

	public static makeFromHandlerAndArgs(run: (context: CommandContext, ...xs: any[]) => any, metadata: Metadata, staticArgs: ArgumentHandler[] = [], optionalArgs: ArgumentHandler[] = [], restArg: ArgumentHandler | null = null): CommandHandler {
		return new CommandHandler(
			run,
			Array.prototype.concat.call( // args = staticArgs ++ optionalArgs ++ (restArg if exists)
				staticArgs,
				optionalArgs,
				restArg === null ? [] : [ restArg, ] // don't add the restArg if there isn't one
			),
			staticArgs.reduce( // minArgs = combined of all static args
				(acc, x) => acc + x.argsTaken,
				0
			),
			metadata
		);
	}

	public run(context: CommandContext, rawArgs: string[]): void {
		const [ didSucceed, argsOrFailure, ] = this.parseArgs(context, rawArgs);
		if (didSucceed) {
			this.utopicRun(context, ...(argsOrFailure as AnyReasonable[]));
		} else {
			this.sendFailure(context, argsOrFailure as ArgumentFailure);
		}
	}

	protected parseArgs(context: CommandContext, rawArgs: string[]): [true, AnyReasonable[], ] | [false, ArgumentFailure, ] {
		const parsedArgs = [];
		for (const [ i, handler, ] of this.args.entries()) {
			// yes, all handlers will be called even if there are no args left
			const [ theseParsedArgs, newRawArgs, ] = handler.getFrom(rawArgs, context);
			rawArgs = newRawArgs;
			if (!Parsers.didSucceed(theseParsedArgs)) {
				return [ false, [ ArgumentFailureReason.PARSE_BAD, i, handler.metadata, theseParsedArgs[1], ], ];
			}
			parsedArgs.push(...theseParsedArgs[1]);
		}
		if (rawArgs.length > 0) { return [ false, [ ArgumentFailureReason.EXCESS, rawArgs.length, ], ]; } // this will not happen if there is a rest argument
		return [ true, parsedArgs, ];
	}

	protected sendFailure({ message: { channel: { send, }, }, config: { giveContextOnError, }, }: CommandContext, reason: ArgumentFailure): void {
		switch (reason[0]) {
			case ArgumentFailureReason.EXCESS:
				send(`You provided ${reason[1]} too many arguments.${giveContextOnError ? " Here's the help page for the command:" : ''}`);
		}
	}
}
