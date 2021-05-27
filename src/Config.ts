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
	 * @default '#574b90'
	 */
	themeColor: string;
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
}

const config: Schema = {
	prefix: ";;",
	mentionAsPrefix: true,
	dbName: "authy",
	themeColor: "#574b90",
	giveContextOnError: true,
	zeroIndexed: false,
	invalidCommandNotice: {
		mention: false,
		prefix: true,
	},
};

export default config;
