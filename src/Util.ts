import type * as Discord from 'discord.js';

export const makeMention = (id: Discord.Snowflake): string => `<@${id}>`;

export function* iteratorMap<T, U>(fn: (arg0: T) => U, iter: IterableIterator<T>): Generator<U, void, void> {
	for (const i of iter) {
		yield fn(i);
	}
}

export const getProperty =
	<K extends string | number | symbol, V>(prop: K) =>
		(x: Record<K, V>): V =>
			x[prop];
