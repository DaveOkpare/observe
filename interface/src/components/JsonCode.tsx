"use client";

import React from "react";

type Tok = { t: 'ws' | 'punct' | 'key' | 'string' | 'number' | 'bool' | 'null'; v: string };

function tokenize(json: string): Tok[] {
  const s = json;
  const toks: Tok[] = [];
  const len = s.length;
  let i = 0;
  const isWS = (c: string) => c === ' ' || c === '\t' || c === '\n' || c === '\r';

  while (i < len) {
    const ch = s[i];
    // Whitespace
    if (isWS(ch)) {
      const start = i;
      while (i < len && isWS(s[i])) i++;
      toks.push({ t: 'ws', v: s.slice(start, i) });
      continue;
    }
    // Strings
    if (ch === '"') {
      const start = i;
      i++;
      let esc = false;
      while (i < len) {
        const c = s[i];
        if (esc) { esc = false; i++; continue; }
        if (c === '\\') { esc = true; i++; continue; }
        if (c === '"') { i++; break; }
        i++;
      }
      const strTok = s.slice(start, i);
      // Peek next non-ws to detect key
      let j = i;
      while (j < len && isWS(s[j])) j++;
      const isKey = s[j] === ':';
      toks.push({ t: isKey ? 'key' : 'string', v: strTok });
      continue;
    }
    // Numbers
    if (ch === '-' || (ch >= '0' && ch <= '9')) {
      const start = i;
      if (s[i] === '-') i++;
      while (i < len && s[i] >= '0' && s[i] <= '9') i++;
      if (s[i] === '.') { i++; while (i < len && s[i] >= '0' && s[i] <= '9') i++; }
      if (s[i] === 'e' || s[i] === 'E') { i++; if (s[i] === '+' || s[i] === '-') i++; while (i < len && s[i] >= '0' && s[i] <= '9') i++; }
      toks.push({ t: 'number', v: s.slice(start, i) });
      continue;
    }
    // true / false / null
    if (s.startsWith('true', i)) { toks.push({ t: 'bool', v: 'true' }); i += 4; continue; }
    if (s.startsWith('false', i)) { toks.push({ t: 'bool', v: 'false' }); i += 5; continue; }
    if (s.startsWith('null', i)) { toks.push({ t: 'null', v: 'null' }); i += 4; continue; }
    // Punctuation
    if ('{}[]:,'.includes(ch)) {
      toks.push({ t: 'punct', v: ch });
      i++;
      continue;
    }
    // Fallback single char
    toks.push({ t: 'punct', v: ch });
    i++;
  }
  return toks;
}

export default function JsonCode({ value, className = "" }: { value: any; className?: string }) {
  const json = React.useMemo(() => (typeof value === 'string' ? value : JSON.stringify(value, null, 2)), [value]);
  const tokens = React.useMemo(() => tokenize(json), [json]);
  const classFor = (t: Tok['t']) => {
    switch (t) {
      case 'key': return 'text-sky-600';
      case 'string': return 'text-emerald-600';
      case 'number': return 'text-blue-600';
      case 'bool': return 'text-purple-600';
      case 'null': return 'text-purple-600';
      case 'punct': return 'text-muted-foreground';
      case 'ws': default: return '';
    }
  };
  return (
    <pre className={`text-xs bg-muted p-2 rounded overflow-auto whitespace-pre-wrap ${className}`}>
      {tokens.map((tok, idx) => tok.t === 'ws' ? tok.v : <span key={idx} className={classFor(tok.t)}>{tok.v}</span>)}
    </pre>
  );
}