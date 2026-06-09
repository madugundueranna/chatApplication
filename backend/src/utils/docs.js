import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { marked } from 'marked';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOC_PATH = path.join(__dirname, '..', '..', 'API_DOCUMENTATION.md');

marked.setOptions({ gfm: true, breaks: false });

const CSS = `
* { box-sizing: border-box; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1f2328; background: #f6f8fa; }
.wrap { max-width: 980px; margin: 0 auto; padding: 32px 24px 80px; }
.card { background: #fff; border: 1px solid #d0d7de; border-radius: 12px; padding: 32px 44px; }
h1,h2,h3,h4 { font-weight: 600; line-height: 1.25; margin: 28px 0 14px; }
h1 { font-size: 30px; padding-bottom: 10px; border-bottom: 2px solid #d0d7de; }
h2 { font-size: 23px; padding-bottom: 8px; border-bottom: 1px solid #d8dee4; margin-top: 40px; }
h3 { font-size: 18px; } h4 { font-size: 15px; color: #57606a; }
p,li { font-size: 15px; }
a { color: #0969da; text-decoration: none; } a:hover { text-decoration: underline; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 13px; background: rgba(175,184,193,.2); padding: .15em .4em; border-radius: 6px; }
pre { background: #0d1117; color: #e6edf3; padding: 16px 18px; border-radius: 10px; overflow: auto; font-size: 13px; line-height: 1.5; }
pre code { background: none; padding: 0; color: inherit; }
table { border-collapse: collapse; width: 100%; margin: 14px 0; display: block; overflow-x: auto; }
th,td { border: 1px solid #d0d7de; padding: 8px 13px; text-align: left; font-size: 14px; vertical-align: top; }
th { background: #f6f8fa; font-weight: 600; } tr:nth-child(2n) td { background: #f6f8fa; }
blockquote { margin: 14px 0; padding: 0 16px; color: #57606a; border-left: 4px solid #d0d7de; }
hr { border: 0; border-top: 1px solid #d8dee4; margin: 32px 0; }
`;

// Render API_DOCUMENTATION.md to a self-contained HTML page on each request (always in sync).
export const renderDocs = () => {
  const body = marked.parse(readFileSync(DOC_PATH, 'utf8'));
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>Chat Application — API Documentation</title><style>${CSS}</style></head><body><div class="wrap"><div class="card">${body}</div></div></body></html>`;
};
