import * as Joi from 'joi';

export interface Schema {
	prefix: string;
	mentionAsPrefix: boolean;
	dbName: string;
	themeColor: string;
	giveContextOnError: boolean;
}

export const schema = Joi.object({
	prefix: Joi.string().min(1).default(';;').regex(/ /, { invert: true, }),
	mentionAsPrefix: Joi.bool().default(true),
	dbName: Joi.string().min(1).default('authy'),
	themeColor: Joi.string().default('#574b90').regex(/#[0-9a-fA-F]{6}/),
	giveContextOnError: Joi.bool().default(true),
});

export const parse = (data: any): Schema => schema.validate(data).value;
