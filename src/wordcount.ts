/** Count prose words: ignores frontmatter, code blocks, comments, link targets. */
export function countWords(text: string): number {
  const prose = text
    .replace(/^---\r?\n[\s\S]*?\r?\n---(\r?\n|$)/, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/%%[\s\S]*?%%/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/!?\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1");
  return prose.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)?.length ?? 0;
}
