import { marked } from 'marked';
import { decodeBase64 } from './decode-base-64';
import { isBase64 } from './is-base-64';

export function decodeMarkdownInput(markdown: string): string {
  return isBase64(markdown) ? decodeBase64(markdown) : markdown;
}

export function markdownToGoogleDocsRequests(markdown: string): any[] {
  const tokens = marked.lexer(markdown);
  let index = 1;
  const requests: any[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const headingText = `${token.text}\n`;
        requests.push({
          insertText: {
            text: headingText,
            endOfSegmentLocation: {},
          },
        });
        requests.push({
          updateParagraphStyle: {
            paragraphStyle: {
              namedStyleType: `HEADING_${token.depth}`,
            },
            range: {
              startIndex: index,
              endIndex: index + headingText.length,
            },
            fields: 'namedStyleType',
          },
        });
        index += headingText.length;
        break;
      }

      case 'paragraph': {
        if (token.tokens) {
          let paragraphText = '';
          const formattingRequests: any[] = [];
          let currentIndex = index;

          for (const inlineToken of token.tokens) {
            if (inlineToken.type === 'text') {
              paragraphText += inlineToken.text;
              currentIndex += inlineToken.text.length;
            } else if (inlineToken.type === 'strong') {
              const boldText = inlineToken.text;
              paragraphText += boldText;
              formattingRequests.push({
                updateTextStyle: {
                  textStyle: { bold: true },
                  range: { startIndex: currentIndex, endIndex: currentIndex + boldText.length },
                  fields: 'bold',
                },
              });
              currentIndex += boldText.length;
            } else if (inlineToken.type === 'em') {
              const italicText = inlineToken.text;
              paragraphText += italicText;
              formattingRequests.push({
                updateTextStyle: {
                  textStyle: { italic: true },
                  range: { startIndex: currentIndex, endIndex: currentIndex + italicText.length },
                  fields: 'italic',
                },
              });
              currentIndex += italicText.length;
            } else if (inlineToken.type === 'link') {
              const linkText = inlineToken.text;
              paragraphText += linkText;
              formattingRequests.push({
                updateTextStyle: {
                  textStyle: { link: { url: inlineToken.href } },
                  range: { startIndex: currentIndex, endIndex: currentIndex + linkText.length },
                  fields: 'link',
                },
              });
              currentIndex += linkText.length;
            } else {
              paragraphText += inlineToken.raw;
              currentIndex += inlineToken.raw.length;
            }
          }

          paragraphText += '\n';
          requests.push({
            insertText: {
              text: paragraphText,
              endOfSegmentLocation: {},
            },
          });
          requests.push(...formattingRequests);
          index += paragraphText.length;
        } else {
          const text = `${token.text}\n`;
          requests.push({
            insertText: {
              text,
              endOfSegmentLocation: {},
            },
          });
          index += text.length;
        }
        break;
      }

      case 'list': {
        for (const item of token.items) {
          const listItemText = `${item.text}\n`;
          requests.push({
            insertText: {
              text: listItemText,
              endOfSegmentLocation: {},
            },
          });
          requests.push({
            createParagraphBullets: {
              range: {
                startIndex: index,
                endIndex: index + listItemText.length,
              },
              bulletPreset: token.ordered ? 'NUMBERED_DECIMAL_ALPHA_ROMAN' : 'BULLET_DISC_CIRCLE_SQUARE',
            },
          });
          index += listItemText.length;
        }
        break;
      }

      case 'table': {
        let tableText = '| ';
        for (const header of token.header) {
          tableText += `${header.text || header} | `;
        }
        tableText += '\n| ';
        for (let i = 0; i < token.header.length; i++) {
          tableText += '--- | ';
        }
        tableText += '\n';
        for (const row of token.rows) {
          tableText += '| ';
          for (const cell of row) {
            tableText += `${cell.text || cell || ''} | `;
          }
          tableText += '\n';
        }
        requests.push({
          insertText: {
            text: `${tableText}\n`,
            endOfSegmentLocation: {},
          },
        });
        requests.push({
          updateTextStyle: {
            textStyle: {
              weightedFontFamily: { fontFamily: 'Consolas' },
            },
            range: { startIndex: index, endIndex: index + tableText.length },
            fields: 'weightedFontFamily',
          },
        });
        index += tableText.length + 1;
        break;
      }

      case 'space':
        requests.push({
          insertText: {
            text: '\n',
            endOfSegmentLocation: {},
          },
        });
        index += 1;
        break;

      default:
        if (token.raw) {
          requests.push({
            insertText: {
              text: token.raw,
              endOfSegmentLocation: {},
            },
          });
          index += token.raw.length;
        }
    }
  }

  return requests;
}
