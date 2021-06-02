import * as Colors from 'colors/safe';

const timestamp = (): string => new Date().toLocaleString(
	'en-GB', // for dmy
	{
		hour12: false,
		year: '2-digit',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		timeZoneName: 'short',
	},
);

const enum LogLevel {
	LOG,
	INFO,
	WARN,
	ERROR,
}

const levelTags: Record<LogLevel, string> = Object.create({
	[LogLevel.LOG]: Colors.dim('[LOG] '),
	[LogLevel.INFO]: Colors.blue('[INFO]'),
	[LogLevel.WARN]: Colors.yellow('[WARN]'),
	[LogLevel.ERROR]: Colors.red('[ERR] '),
});

function _log(level: LogLevel, str: string): void {
	process.stdout.write(`${timestamp()} ${levelTags[level]} ${str}\n`);
}

export function log(str: string): void {
	_log(LogLevel.LOG, str);
}

export function info(str: string): void {
	_log(LogLevel.INFO, str);
}

export function warn(str: string): void {
	_log(LogLevel.WARN, str);
}

export function error(str: string): void {
	_log(LogLevel.ERROR, str);
}

export default {
	log,
	info,
	warn,
	error,
};
