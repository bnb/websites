// A comment's text is Markdown, written by anyone, so it's rendered with raw
// HTML off (markdown-it escapes it), no images or headings, and links that
// open in a new tab without passing the page on. markdown-it also refuses
// javascript:, vbscript: and file: links. Loaded only when there are comments.
import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true }).disable([
	'image',
	'heading',
	'lheading',
	'table'
]);

markdown.renderer.rules.link_open = (tokens, index, options, _env, self) => {
	tokens[index].attrSet('rel', 'nofollow ugc noopener noreferrer');
	tokens[index].attrSet('target', '_blank');
	return self.renderToken(tokens, index, options);
};

/** A comment's text as safe HTML. */
export const renderMarkdown = (text: string): string => markdown.render(text);
