import type * as Discord from 'discord.js';
import * as Parsers from './Parsers';
import type { Parser, } from './Parsers';
import { ParseFailureReason, } from './Parsers';
import type { IDBManager, } from './Database';
import { help, } from './Commands/All';
import { indexToString, } from './Strings';
import config from './Config';

export type ArgType = Parser<any, false>;

export const enum ArgKind {
	REQUIRED,
	OPTIONAL,
	REST,
}

export interface CommandContext {
	message: Discord.Message;
	client: Discord.Client;
	// eslint-disable-next-line no-use-before-define
	commands: Map<string, CommandHandler>;
	db: IDBManager;
	currentCommand: string;
}

export interface Metadata {
	name: string;
	shortDesc: string;
	longDesc?: string;
}

type AnyReasonable = string | number | boolean | null | undefined | Array<any> | Record<any, any>;

type ArgumentParseFailure = [ ParseFailureReason, number?, ];

export class ArgumentHandler {
	public readonly getFrom: (args: string[], context: CommandContext) => Promise<[ AnyReasonable[], string[], ]>;
	public readonly metadata: Metadata;
	public readonly kind: ArgKind;
	public readonly type: ArgType;
	// -1 if `kind` is rest; max if `kind` is optional
	public readonly argsTaken: number;

	public readonly repr: string;

	public constructor(
		getFrom: (args: string[], context: CommandContext) => Promise<[ AnyReasonable[], string[], ]>,
		metadata: Metadata,
		kind: ArgKind,
		type: ArgType,
		argsTaken: number,
	) {
		this.getFrom = getFrom;
		this.metadata = metadata;
		this.kind = kind;
		this.type = type;
		this.argsTaken = argsTaken;

		this.repr = kindWrapper[this.kind](`${this.metadata.name}: ${this.type.type ?? this.type.name}`);
	}
}

export class StaticArgumentHandler extends ArgumentHandler {
	public constructor(argHandler: ArgType, metadata: Metadata) {
		super(async (args, context) => {
			if (args.length < 1) throw [ Parsers.ParseFailureReason.VALUE_REQUIRED, ];
			try {
				const parseResult = await argHandler(args[0], context);
				return [ [ parseResult, ], args.slice(1), ];
			} catch (e) {
				if (Number.isInteger(e)) {
					throw [ e, ];
				} else {
					throw e;
				}
			}
		}, metadata, ArgKind.REQUIRED, argHandler, 1);
	}
}

export class OptionalArgumentHandler extends ArgumentHandler {
	public constructor(argHandler: ArgType, metadata: Metadata) {
		super(async (args, context) => {
			if (args.length < 1) return [ [ void 0, ], args.slice(1), ];
			try {
				const parseResult = await argHandler(args[0], context);
				return [ [ parseResult, ], args.slice(1), ];
			} catch (e) {
				if (Number.isInteger(e)) {
					throw [ e, ];
				} else {
					throw e;
				}
			}
		}, metadata, ArgKind.OPTIONAL, argHandler, 1);
	}
}

export class RestArgumentHandler extends ArgumentHandler {
	public constructor(argHandler: ArgType, metadata: Metadata) {
		super(async (args, context) => {
			const parsedArgs: AnyReasonable[] = await Promise.all(args.map((arg, idx) => argHandler(arg, context).catch(e => {
				if (Number.isInteger(e)) {
					throw [ e, idx, ]; // include index of failed argument
				} else {
					throw e;
				}
			})));
			return [ parsedArgs, [], ];
		}, metadata, ArgKind.REST, argHandler, -1);
	}
}

const kindWrapper: Record<ArgKind, (x: string) => string> = {
	[ArgKind.REQUIRED]: x => `<${x}>`,
	[ArgKind.OPTIONAL]: x => `[${x}]`,
	[ArgKind.REST]: x => `[${x} ...]`,
};

const enum ArgumentFailureReason {
	EXCESS,
	PARSE_BAD,
}

type ArgumentFailure =
	[ArgumentFailureReason.EXCESS, number, ] | // number of extra args left after parsing
	[ArgumentFailureReason.PARSE_BAD, number, Metadata, Parsers.ParseFailureReason, ]; // index, arg metadata, reason

function isArgumentFailure(x: unknown): x is ArgumentFailure {
	return Array.isArray(x)
		&& Number.isInteger(x[0])
		&& Number.isInteger(x[1])
		&& (
			(
				x.length === 2
			) || (
				x.length === 4 && x[2]
				&& Number.isInteger(x[3])
			)
		);
}

export class CommandHandler {
	public readonly args: ArgumentHandler[];
	public readonly minArgs: number;
	public readonly metadata: Metadata;
	protected readonly utopicRun: (context: CommandContext, ...xs: any[]) => any;

	public constructor(utopicRun: (context: CommandContext, ...xs: any[]) => any, args: ArgumentHandler[], minArgs: number, metadata: Metadata) {
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
				restArg === null ? [] : [ restArg, ], // don't add the restArg if there isn't one
			),
			staticArgs.reduce( // minArgs = combined of all static args
				(acc, x) => acc + x.argsTaken,
				0,
			),
			metadata,
		);
	}

	public async run(context: CommandContext, rawArgs: string[]): Promise<void> {
		try {
			const parsedArgs = await this.parseArgs(context, rawArgs);
			this.utopicRun(context, ...parsedArgs);
		} catch (e) {
			if (!isArgumentFailure(e)) { throw e; }
			this.sendFailure(context, e);
		}
	}

	protected async parseArgs(context: CommandContext, rawArgs: string[]): Promise<AnyReasonable[]> {
		const parsedArgs = [];
		for (const [ i, handler, ] of this.args.entries()) {
			try {
				const [ theseParsedArgs, newRawArgs, ] = await handler.getFrom(rawArgs, context);
				rawArgs = newRawArgs;
				parsedArgs.push(...theseParsedArgs);
			} catch (e) {
				if (Array.isArray(e) && e.length in [ 0, 1, ] && Number.isInteger(e[0]) && Number.isInteger(e[1] ?? 0)) {
					throw [ ArgumentFailureReason.PARSE_BAD, (e[1] ?? 0) + i, handler.metadata, e[0], ];
				}
			}
		}
		if (rawArgs.length > 0) { throw [ ArgumentFailureReason.EXCESS, rawArgs.length, ]; } // this will not happen if there is a rest argument
		return parsedArgs;
	}

	protected sendFailure(context: CommandContext, reason: ArgumentFailure): void {
		context.message.channel.send(reason[0] === ArgumentFailureReason.EXCESS
			? `You provided ${reason[1]} too many arguments.`
			: failureToString(reason.slice(1) as [ number, Metadata, ParseFailureReason, ]),
		);
		if (config.giveContextOnError) {
			help(context, context.currentCommand);
		}
	}
}

const failureToString = ([ idx, { name, }, reason, ]: [ number, Metadata, ParseFailureReason, ]): string => {
	switch (reason) {
		case ParseFailureReason.VALUE_REQUIRED:
			return `Required argument \`${name}\` (${indexToString(idx)}) was not provided.`;
		case ParseFailureReason.NO_PARSER_MATCHED:
		case ParseFailureReason.BAD_FORMAT:
			return `Argument \`${name}\` (${indexToString(idx)}) had an invalid format.`;
		case ParseFailureReason.BAD_VALUE:
			return `Argument \`${name}\` (${indexToString(idx)}) had a bad value.`;
		case ParseFailureReason.NOT_APPLICABLE:
			return 'This command is not valid in this context.';
	}
};
