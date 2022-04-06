export interface Schema {
	/**
	 * The prefix to respond to in chat
	 * No spaces, and might be good to avoid hard-to-type unicode
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
	 * @default '[87, 75, 144]'
	 */
	themeColor: [number, number, number];
	/**
	 * Whether to send the help page for the command when it's misused
	 * @default true
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
	 * @default { mention: false, prefix: true, }
	 */
	invalidCommandNotice: {
		mention: boolean;
		prefix: boolean;
	};
	/**
	 * Formatting of dates in Discord.
	 * @see https://day.js.org/docs/en/display/format
	 * @default 'DD-MM-YYYYZ'
	 */
	dateFormat: string;
}

const config: Schema = {
	prefix: ";;",
	mentionAsPrefix: true,
	dbName: "authy",
	themeColor: [87, 75, 144],
	giveContextOnError: true,
	zeroIndexed: false,
	invalidCommandNotice: {
		mention: false,
		prefix: true,
	},
	dateFormat: 'DD-MM-YYYYZ',
};

export default config;
