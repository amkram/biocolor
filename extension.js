"use strict";
const vscode = require("vscode");

// ───────────────────────────────────────────────────────────────────────────
// Muted IUPAC-style palettes (foreground). Mid-tone / desaturated so they read
// on dark and light themes without being garish.
// ───────────────────────────────────────────────────────────────────────────
const GREY = "#9098a0";
const NT_RGB = {
  A: [78, 154, 107], C: [79, 134, 198], G: [199, 154, 62], T: [203, 106, 99], U: [203, 106, 99],
  R: [144, 152, 160], Y: [144, 152, 160], S: [144, 152, 160], W: [144, 152, 160],
  K: [144, 152, 160], M: [144, 152, 160], B: [144, 152, 160], D: [144, 152, 160],
  H: [144, 152, 160], V: [144, 152, 160], N: [130, 138, 146],
};
const AA_RGB = {
  A: [102, 145, 196], V: [102, 145, 196], L: [102, 145, 196], I: [102, 145, 196],
  M: [102, 145, 196], F: [102, 145, 196], W: [102, 145, 196],         // hydrophobic
  K: [203, 106, 99], R: [203, 106, 99],                                // basic
  D: [176, 124, 198], E: [176, 124, 198],                              // acidic
  N: [90, 160, 111], Q: [90, 160, 111], S: [90, 160, 111], T: [90, 160, 111], // polar
  C: [217, 143, 176],                                                  // cysteine
  G: [210, 154, 82],                                                   // glycine
  P: [182, 168, 67],                                                   // proline
  H: [79, 163, 163], Y: [79, 163, 163],                                // aromatic
};
const QUAL_RGB = [78, 174, 96]; // fastq quality highlight (green)
const GAP_RGB = [120, 128, 138]; // muted gray for -.*~ gap chars and <color> tags

// Alphabets for detection.
const NT_ALPHA = new Set("ACGTUNRYSWKMBDHV".split(""));
const AA_ALPHA = new Set("ACDEFGHIKLMNPQRSTVWYBXZ".split(""));
const PROTEIN_ONLY = new Set("EFILPQZJO".split("")); // never nucleotide IUPAC
const GAPCH = new Set("-.*~ ".split(""));

// thresholds for AUTO-detection (forced <color> blocks bypass these)
const NT_MINLEN = 12, NT_FRAC = 0.9;
const AA_MINLEN = 12, AA_FRAC = 0.9, AA_MINDISTINCT = 8; // matches NT minimum; AA_MINDISTINCT=8 still suppresses most prose
const CONS_MIN_ROWS = 3;         // conservation needs >=3 sequences to be meaningful
const CONS_RGB = [150, 165, 190];// neutral highlight behind conserved columns
const CONS_BG_MAX = 0.24;        // background alpha at full conservation (letters stay full color)
const MAX_CELLS = 300000;        // safety cap

const RUN_RE = /[A-Za-z.*~-]+/g; // sequence-candidate runs on a line
const BLOCK_RE = /<color>([\s\S]*?)<\/color>/g;

// ── config ──────────────────────────────────────────────────────────────────
function cfg() { return vscode.workspace.getConfiguration("biocolor"); }
const opt = (k, d) => cfg().get(k, d);

// ── decoration cache (key -> DecorationType) ─────────────────────────────────
const decoCache = new Map();
function fgDeco(rgb, alpha) {
  const a = Math.max(0, Math.min(1, alpha));
  const key = `fg|${rgb}|${a.toFixed(2)}`;
  let d = decoCache.get(key);
  if (!d) {
    d = vscode.window.createTextEditorDecorationType({
      color: `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`,
      rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
    });
    decoCache.set(key, d);
  }
  return d;
}
function bgDeco(rgb, alpha) {
  const a = Math.max(0, Math.min(1, alpha));
  const key = `bg|${rgb}|${a.toFixed(2)}`;
  let d = decoCache.get(key);
  if (!d) {
    d = vscode.window.createTextEditorDecorationType({
      backgroundColor: `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`,
    });
    decoCache.set(key, d);
  }
  return d;
}
let tagDeco = null;
function getTagDeco() {
  if (!tagDeco) tagDeco = vscode.window.createTextEditorDecorationType({
    color: `rgba(${GAP_RGB[0]},${GAP_RGB[1]},${GAP_RGB[2]},0.55)`,
  });
  return tagDeco;
}

// ── detection ────────────────────────────────────────────────────────────────
// Return 'nt' | 'aa' | null for a candidate run. `forced` (inside a <color>
// block) trusts that it IS a sequence and only picks the palette.
function classifyRun(run, forced) {
  let nLet = 0, nt = 0, aa = 0, prot = 0, lower = 0, upper = 0;
  const seen = new Set();
  for (const ch of run) {
    if (GAPCH.has(ch)) continue;
    const u = ch.toUpperCase();
    if (u < "A" || u > "Z") continue;
    nLet++;
    seen.add(u);
    if (ch >= "a" && ch <= "z") lower++; else upper++;
    if (NT_ALPHA.has(u)) nt++;
    if (AA_ALPHA.has(u)) aa++;
    if (PROTEIN_ONLY.has(u)) prot++;
  }
  if (nLet === 0) return null;
  if (forced) return prot > 0 ? "aa" : "nt";   // explicit: just choose the palette
  const uniformCase = lower === 0 || upper === 0;
  if (nt / nLet >= NT_FRAC && nLet >= NT_MINLEN && seen.size >= 2 && uniformCase) return "nt";
  if (aa / nLet >= AA_FRAC && nLet >= AA_MINLEN && seen.size >= AA_MINDISTINCT && uniformCase) return "aa";
  return null;
}

// offset intervals of <color> block CONTENT, plus the tag ranges to dim.
function scanBlocks(text) {
  const content = [], tags = [];
  let m;
  BLOCK_RE.lastIndex = 0;
  while ((m = BLOCK_RE.exec(text)) !== null) {
    const cs = m.index + "<color>".length;
    const ce = cs + m[1].length;
    content.push([cs, ce]);
    tags.push([m.index, cs], [ce, ce + "</color>".length]);
  }
  return { content, tags };
}
const inAny = (off, ivals) => ivals.some(([s, e]) => off >= s && off < e);

// Find FASTQ-style 4-line records (@hdr / seq / + / qual) anywhere in any document.
// seq must be a real NT line (>=4 letters, >=85% NT alphabet) so prose doesn't
// false-trigger on a stray @ + pair. qual must be non-empty. Length mismatch
// between seq and qual is tolerated (real-world FASTQs sometimes drift by 1).
function scanFastqBlocks(doc) {
  const claimed = new Set();
  const records = [];
  for (let ln = 0; ln + 3 < doc.lineCount; ln++) {
    if (claimed.has(ln)) continue;
    if (doc.lineAt(ln).text[0] !== "@") continue;
    const seq = doc.lineAt(ln + 1).text;
    const plus = doc.lineAt(ln + 2).text;
    const qual = doc.lineAt(ln + 3).text;
    if (plus[0] !== "+") continue;
    if (seq.length < 4 || qual.length < 1) continue;
    let nt = 0, letters = 0;
    for (let i = 0; i < seq.length; i++) {
      const c = seq[i];
      if (c >= "A" && c <= "z" && ((c >= "A" && c <= "Z") || (c >= "a" && c <= "z"))) {
        letters++;
        if (NT_ALPHA.has(c.toUpperCase())) nt++;
      }
    }
    if (letters < 4 || nt / letters < 0.85) continue;
    claimed.add(ln); claimed.add(ln + 1); claimed.add(ln + 2); claimed.add(ln + 3);
    records.push({ seqLine: ln + 1, qualLine: ln + 3 });
    ln += 3;
  }
  return { claimed, records };
}

// ── per-cell coloring for a normal (non-fastq) document ──────────────────────
function colorGeneric(editor) {
  const doc = editor.document;
  const text = doc.getText();
  const { content, tags } = scanBlocks(text);
  const fq = scanFastqBlocks(doc);
  const autoDetect = opt("autoDetect", true);

  // 1) gather sequence runs across all lines (skipping lines claimed by FASTQ blocks)
  const runs = []; // {line, col, seq, type, alpha:Float32Array|null}
  let cells = 0;
  for (let ln = 0; ln < doc.lineCount && cells < MAX_CELLS; ln++) {
    if (fq.claimed.has(ln)) continue;
    const lineText = doc.lineAt(ln).text;
    let mm;
    RUN_RE.lastIndex = 0;
    while ((mm = RUN_RE.exec(lineText)) !== null) {
      const col = mm.index, seq = mm[0];
      const off = doc.offsetAt(new vscode.Position(ln, col));
      const forced = inAny(off, content);
      if (!forced && !autoDetect) continue;
      const type = classifyRun(seq, forced);
      if (!type) continue;
      runs.push({ line: ln, col, seq, type });
      cells += seq.length;
    }
  }

  const ranges = new Map(); // DecorationType -> Range[]
  const push = (deco, range) => {
    let arr = ranges.get(deco);
    if (!arr) ranges.set(deco, (arr = []));
    arr.push(range);
  };

  // 1b) FASTQ blocks found inside the document — NT colors on seq, Phred on qual
  for (const { seqLine, qualLine } of fq.records) {
    const seq = doc.lineAt(seqLine).text;
    for (let i = 0; i < seq.length; i++) {
      const ch = seq[i];
      const rgb = NT_RGB[ch.toUpperCase()];
      if (rgb) push(fgDeco(rgb, 1), new vscode.Range(seqLine, i, seqLine, i + 1));
      else if (GAPCH.has(ch)) push(fgDeco(GAP_RGB, 0.6), new vscode.Range(seqLine, i, seqLine, i + 1));
    }
    const qual = doc.lineAt(qualLine).text;
    for (let i = 0; i < qual.length; i++) {
      const Q = qual.charCodeAt(i) - 33;
      const f = Math.max(0, Math.min(1, (Q - 8) / 32));
      const a = 0.05 + 0.95 * Math.pow(f, 1.6);
      const bucket = Math.round(a * 16) / 16;
      push(fgDeco(QUAL_RGB, bucket), new vscode.Range(qualLine, i, qualLine, i + 1));
    }
  }

  // 2) residue colors — ALWAYS full strength so nothing ever looks uncolored.
  //    Gap chars (-.*~) inside a colored run render as muted gray.
  for (const r of runs) {
    const pal = r.type === "nt" ? NT_RGB : AA_RGB;
    for (let p = 0; p < r.seq.length; p++) {
      const ch = r.seq[p];
      const rgb = pal[ch.toUpperCase()];
      if (rgb) {
        push(fgDeco(rgb, 1), new vscode.Range(r.line, r.col + p, r.line, r.col + p + 1));
      } else if (GAPCH.has(ch)) {
        push(fgDeco(GAP_RGB, 0.6), new vscode.Range(r.line, r.col + p, r.line, r.col + p + 1));
      }
    }
  }

  // 3) conservation — a gentle BACKGROUND highlight on conserved columns of
  //    stacked, same-col/len/type blocks (>=3 rows). Letters keep full color.
  if (opt("conservation", true)) {
    const byKey = new Map();
    for (const r of runs) {
      const k = `${r.col}|${r.seq.length}|${r.type}`;
      (byKey.get(k) || byKey.set(k, []).get(k)).push(r);
    }
    for (const group of byKey.values()) {
      group.sort((a, b) => a.line - b.line);
      for (let i = 0; i < group.length;) {
        let j = i;
        while (j + 1 < group.length && group[j + 1].line === group[j].line + 1) j++;
        const block = group.slice(i, j + 1);
        i = j + 1;
        if (block.length < CONS_MIN_ROWS) continue;  // 1-2 seqs -> no shading
        const L = block[0].seq.length;
        for (let p = 0; p < L; p++) {
          const counts = {};
          let best = 0, n = 0;
          for (const r of block) {
            const u = r.seq[p].toUpperCase();
            if (GAPCH.has(r.seq[p]) || u < "A" || u > "Z") continue;
            n++; counts[u] = (counts[u] || 0) + 1;
            if (counts[u] > best) best = counts[u];
          }
          if (n < 2) continue;
          const cons = best / block.length;                       // gappy/variable -> low
          const a = Math.max(0, (cons - 0.5) / 0.5) * CONS_BG_MAX; // only >50%-conserved columns glow
          if (a <= 0) continue;
          const bucket = Math.round(a * 24) / 24;
          for (const r of block) {
            const u = r.seq[p].toUpperCase();
            if (GAPCH.has(r.seq[p]) || u < "A" || u > "Z") continue;
            push(bgDeco(CONS_RGB, bucket), new vscode.Range(r.line, r.col + p, r.line, r.col + p + 1));
          }
        }
      }
    }
  }

  applyDecorations(editor, ranges, opt("colorTags", true) ? tags : []);
}

// ── fastq: color sequence (nt) + quality (green by Phred magnitude) ──────────
function colorFastq(editor) {
  const doc = editor.document;
  const ranges = new Map();
  const push = (deco, range) => {
    let arr = ranges.get(deco);
    if (!arr) ranges.set(deco, (arr = []));
    arr.push(range);
  };
  let ln = 0, cells = 0;
  while (ln + 3 < doc.lineCount && cells < MAX_CELLS) {
    const h = doc.lineAt(ln).text;
    if (h[0] !== "@") { ln++; continue; }
    const seq = doc.lineAt(ln + 1).text;
    const plus = doc.lineAt(ln + 2).text;
    const qual = doc.lineAt(ln + 3).text;
    // Trust the structural markers (@ and +); don't require seq.len === qual.len.
    // Real-world FASTQs sometimes drift by 1; coloring each line to its own length
    // is more useful than dumping into the generic colorer.
    if (plus[0] === "+" && seq.length > 0) {
      for (let i = 0; i < seq.length; i++) {
        const ch = seq[i];
        const rgb = NT_RGB[ch.toUpperCase()];
        if (rgb) {
          push(fgDeco(rgb, 1), new vscode.Range(ln + 1, i, ln + 1, i + 1));
        } else if (GAPCH.has(ch)) {
          push(fgDeco(GAP_RGB, 0.6), new vscode.Range(ln + 1, i, ln + 1, i + 1));
        }
      }
      for (let i = 0; i < qual.length; i++) {
        const Q = qual.charCodeAt(i) - 33;            // Sanger/Illumina-1.8 Phred
        const f = Math.max(0, Math.min(1, (Q - 8) / 32)); // spread the useful Q8..Q40 range
        const a = 0.05 + 0.95 * Math.pow(f, 1.6);     // steep low->high gradient on the symbol
        const bucket = Math.round(a * 16) / 16;
        push(fgDeco(QUAL_RGB, bucket), new vscode.Range(ln + 3, i, ln + 3, i + 1));
      }
      cells += seq.length + qual.length;
      ln += 4;
    } else ln++;
  }
  applyDecorations(editor, ranges, []);
}

// set the wanted ranges and clear every other known decoration type
function applyDecorations(editor, ranges, tagRanges) {
  for (const deco of decoCache.values()) editor.setDecorations(deco, ranges.get(deco) || []);
  editor.setDecorations(getTagDeco(), tagRanges);
}

function isFastq(doc) {
  if (doc.languageId === "fastq") return true;
  if (/\.(fastq|fq)$/i.test(doc.fileName)) return true;
  // content sniff: first non-empty line @, and a '+' on line 3 of a 4-line group
  if (doc.lineCount >= 4) {
    const l0 = doc.lineAt(0).text, l2 = doc.lineAt(2).text;
    if (l0[0] === "@" && l2[0] === "+" &&
        doc.lineAt(1).text.length === doc.lineAt(3).text.length && doc.lineAt(1).text.length > 0)
      return true;
  }
  return false;
}

function apply(editor) {
  if (!editor) return;
  if (!opt("enabled", true)) { applyDecorations(editor, new Map(), []); return; }
  try {
    if (isFastq(editor.document)) colorFastq(editor);
    else colorGeneric(editor);
  } catch (e) { /* never throw from a decoration pass */ }
}
function applyAll() { for (const ed of vscode.window.visibleTextEditors) apply(ed); }

let timer;
function scheduleAll() { clearTimeout(timer); timer = setTimeout(applyAll, 120); }

// Hover: show Phred Q value when hovering a FASTQ quality-line character.
// Validates the FASTQ structural signature (line - 1 starts with '+', line - 3
// starts with '@') so the hover only fires inside a real FASTQ block, even in
// prose/markdown documents.
const qualHoverProvider = {
  provideHover(doc, pos) {
    if (pos.line < 3) return;
    if (doc.lineAt(pos.line - 1).text[0] !== "+") return;
    if (doc.lineAt(pos.line - 3).text[0] !== "@") return;
    const line = doc.lineAt(pos.line).text;
    if (pos.character >= line.length) return;
    const ch = line[pos.character];
    const Q = ch.charCodeAt(0) - 33;                   // Sanger/Illumina-1.8 Phred
    if (Q < 0 || Q > 93) return;                       // outside Phred range
    const Perr = Math.pow(10, -Q / 10);
    const accuracy = (1 - Perr) * 100;
    const md = new vscode.MarkdownString(
      `**Q${Q}**  ·  char \`${ch}\` (ASCII ${ch.charCodeAt(0)})  \n` +
      `error probability ${Perr.toExponential(2)}  ·  accuracy ${accuracy.toFixed(accuracy >= 99.9 ? 3 : 2)}%`
    );
    return new vscode.Hover(md, new vscode.Range(pos.line, pos.character, pos.line, pos.character + 1));
  },
};

function activate(context) {
  applyAll();
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(apply),
    vscode.window.onDidChangeVisibleTextEditors(applyAll),
    vscode.workspace.onDidChangeTextDocument(() => scheduleAll()),
    vscode.workspace.onDidChangeConfiguration((e) => { if (e.affectsConfiguration("biocolor")) applyAll(); }),
    vscode.commands.registerCommand("biocolor.toggle", async () => {
      const c = cfg();
      await c.update("enabled", !c.get("enabled", true), vscode.ConfigurationTarget.Global);
      applyAll();
    }),
    vscode.languages.registerHoverProvider({ scheme: "*" }, qualHoverProvider),
  );
}
function deactivate() {
  for (const d of decoCache.values()) d.dispose();
  decoCache.clear();
  if (tagDeco) tagDeco.dispose();
}
module.exports = { activate, deactivate };
