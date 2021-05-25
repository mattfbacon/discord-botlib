import * as Joi from 'joi';

export interface Schema {
	/**
	 * The prefix to respond to in chat
	 * @default ';;'
	 */
	prefix: string;
	/**
	 * Whether mentioning the bot in place of a prefix activates the bot
	 * @default true
	 */
	mentionAsPrefix: boolean;
	/**
	 * Essentially the namespace within the database. Can be used to avoid
	 * conflicts in the case of multiple instances.
	 * @default 'authy'
	 */
	dbName: string;
	/**
	 * Hex color used wherever it can be
	 * @default '#574b90'
	 */
	themeColor: string;
	/**
	 * Whether to send the help page for the command when it's misused
	 * @defoult true
	 */
	giveContextOnError: boolean;
	/**
	 * Indexes can be one-indexed or zero-indexed depending on your target
	 * audience.
	 * @default false // one-indexed
	 */
	zeroIndexed: boolean;
	/**
	 * Whether to tell the user that the command was invalid.
	 *
	 * A boolean value (accepted but transformed by Joi) means that value for
	 * both.
	 * @default { mention: false, prefix: true, }
	 */
	invalidCommandNotice: {
		mention: boolean;
		prefix: boolean;
	};
}

const schema = Joi.object({
	prefix: Joi.string().min(1).default(';;').regex(/ /, { invert: true, }),
	mentionAsPrefix: Joi.bool().default(true),
	dbName: Joi.string().min(1).max(64).default('authy').regex(/[0-9a-zA-Z_]+/),
	themeColor: Joi.string().default('#574b90').regex(/^#[0-9a-fA-F]{6}$/),
	giveContextOnError: Joi.bool().default(true),
	zeroIndexed: Joi.bool().default(false),
	invalidCommandNotice: Joi.alternatives(
		Joi.bool().custom((value, _helpers) => ({ mention: value, prefix: value, })),
		Joi.object({
			mention: Joi.bool().default(false),
			prefix: Joi.bool().default(true),
		})
	).default({ mention: false, prefix: true, }),
});

const parse = (data: any): Schema => schema.validate(data).value;

import config from './YourConfig';
export default parse(config);
