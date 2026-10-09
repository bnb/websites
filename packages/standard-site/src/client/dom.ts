type Child = Node | string | false | null | undefined;
type Attribute = string | true | ((event: Event) => void);

/**
 * An element, its attributes (`on…` ones are listeners, `true` is a bare
 * attribute) and its children. Text is always text, never HTML.
 */
export function h<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	attributes: Record<string, Attribute> = {},
	...children: Child[]
): HTMLElementTagNameMap[K] {
	const element = document.createElement(tag);
	for (const [name, value] of Object.entries(attributes)) {
		if (typeof value === 'function') element.addEventListener(name.slice(2), value);
		else element.setAttribute(name, value === true ? '' : value);
	}
	element.append(...children.filter((child) => child !== false && child != null));
	return element;
}
