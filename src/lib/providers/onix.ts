import { normalizeInvertedName } from './names';

/**
 * The ONIX 3.0 bits of an e-ISBN product record.
 *
 * **This is not an XML parser and does not pretend to be one.** React Native
 * ships no DOMParser, and pulling in a full parser to read eight text elements
 * out of one `<Product>` would be a dependency for its own sake. What follows
 * is a tag scanner over a scope that is always a single product from a single
 * generator, where every field we read is a plain text element with no
 * attributes and no mixed content. That is narrow enough to be safe; it would
 * not be safe against arbitrary XML, and it is not used for any.
 *
 * ONIX codes used below (EDItEUR lists 5, 15, 17, 150):
 *   ProductIDType 15 = ISBN-13, 02 = ISBN-10
 *   TitleType 01 = distinctive title
 *   ContributorRole A01 = by (author). B06 is a translator and is skipped.
 *   PublishingDateRole 01 = publication date
 *   ExtentType 00 / 11 = main content page count
 */

export type OnixBook = {
  isbn13: string | null;
  isbn10: string | null;
  title: string;
  subtitle: string;
  authors: string[];
  publisher: string;
  publishedDate: string | null;
  pageCount: number | null;
  language: string;
};

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, name: string) => ENTITIES[name]);
}

/**
 * Every `<Tag>...</Tag>` body inside a scope, in document order.
 *
 * Scanned with indexOf rather than a regex, because the tag names share
 * prefixes: `<Product` also opens `<ProductIdentifier>` and `<ProductForm>`,
 * so the character after the name has to be checked. Anything at or below a
 * space is whitespace, which avoids escape sequences in the comparison.
 */
export function blocks(scope: string, tag: string): string[] {
  const out: string[] = [];
  const open = '<' + tag;
  const close = '</' + tag + '>';
  let from = 0;

  for (;;) {
    const start = scope.indexOf(open, from);
    if (start === -1) break;
    const next = scope[start + open.length];
    if (next !== '>' && !(next <= ' ')) {
      from = start + open.length;
      continue;
    }
    const bodyStart = scope.indexOf('>', start);
    if (bodyStart === -1) break;
    // `<Tag/>` is self-closing and has no body.
    if (scope[bodyStart - 1] === '/') {
      from = bodyStart + 1;
      continue;
    }
    const bodyEnd = scope.indexOf(close, bodyStart);
    if (bodyEnd === -1) break;
    out.push(scope.slice(bodyStart + 1, bodyEnd));
    from = bodyEnd + close.length;
  }
  return out;
}

/** The first `<Tag>` body in a scope as trimmed text, or ''. */
export function text(scope: string, tag: string): string {
  return decodeEntities(blocks(scope, tag)[0] ?? '').trim();
}

/** The first `<Product>` in a response — a lookup by ISBN returns at most one. */
export function firstProduct(xml: string): string | null {
  return blocks(xml, 'Product')[0] ?? null;
}

function identifier(product: string, idType: string): string | null {
  for (const block of blocks(product, 'ProductIdentifier')) {
    if (text(block, 'ProductIDType') === idType) {
      const value = text(block, 'IDValue').replace(/[^0-9Xx]/g, '').toUpperCase();
      if (value) return value;
    }
  }
  return null;
}

/** `20221130` -> `2022-11-30`; a bare year or year-month is kept as-is. */
export function onixDate(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 8) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  if (digits.length === 6) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}`;
  if (digits.length === 4) return digits;
  return null;
}

function contributors(product: string): string[] {
  const names: string[] = [];
  for (const block of blocks(product, 'Contributor')) {
    // A01 is "by (author)". Without this filter a Polish translation credits
    // its translator (B06) as a co-author of the novel.
    if (text(block, 'ContributorRole') !== 'A01') continue;
    const raw = text(block, 'PersonNameInverted') || text(block, 'PersonName') || text(block, 'CorporateName');
    const name = text(block, 'PersonNameInverted') ? normalizeInvertedName(raw) : raw;
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

function titleOf(product: string): { title: string; subtitle: string } {
  for (const detail of blocks(product, 'TitleDetail')) {
    if (text(detail, 'TitleType') !== '01') continue;
    const element = blocks(detail, 'TitleElement')[0] ?? detail;
    const part = text(element, 'PartNumber');
    const main = text(element, 'TitleText');
    // A volume of a series carries its part separately: "Słownik…" + "T. 2".
    return { title: part ? `${main} (${part})` : main, subtitle: text(element, 'Subtitle').replace(/\s*\/$/, '') };
  }
  return { title: '', subtitle: '' };
}

function extentPages(product: string): number | null {
  for (const block of blocks(product, 'Extent')) {
    if (!['00', '11'].includes(text(block, 'ExtentType'))) continue;
    const pages = parseInt(text(block, 'ExtentValue'), 10);
    if (Number.isFinite(pages) && pages > 0) return pages;
  }
  return null;
}

function publishedDate(product: string): string | null {
  for (const block of blocks(product, 'PublishingDate')) {
    if (text(block, 'PublishingDateRole') === '01') return onixDate(text(block, 'Date'));
  }
  return null;
}

export function parseOnixProduct(xml: string): OnixBook | null {
  const product = firstProduct(xml);
  if (!product) return null;

  const { title, subtitle } = titleOf(product);
  // A product with no distinctive title is a record we cannot render.
  if (!title) return null;

  return {
    isbn13: identifier(product, '15'),
    isbn10: identifier(product, '02'),
    title,
    subtitle,
    authors: contributors(product),
    publisher: text(product, 'PublisherName') || text(product, 'ImprintName'),
    publishedDate: publishedDate(product),
    pageCount: extentPages(product),
    language: text(product, 'LanguageCode'),
  };
}
