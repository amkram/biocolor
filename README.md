# Biocolor

Inline coloring for biological sequences in **any** file — notes, logs, alignment
dumps, scratch buffers. Muted, theme-friendly palettes. No language mode required.

## What it does

- **Auto-detect.** Runs of nucleotide (≥12 nt, ≥90% NT alphabet) or amino-acid
  (≥12 aa, ≥90% AA alphabet, ≥8 distinct letters) get colored automatically.
  IUPAC ambiguity codes (`R Y S W K M B D H V N`) render muted grey. Prose,
  identifiers, and accessions are left alone.
- **MSA conservation shading.** Stacked, equal-column / equal-length / equal-type
  rows are treated as an alignment; conserved columns get a soft background glow
  while residue colors stay full strength. ≥3 rows trigger shading.
- **Gap chars muted.** `- . * ~` inside any colored run render in muted grey so
  alignments read cleanly without dashes dominating.
- **FASTQ blocks anywhere.** Four-line `@hdr / seq / + / qual` records are
  detected and colored even inside `.md`, `.txt`, or scratch buffers — not just
  in `.fastq` files. Sequence line gets NT colors; quality line gets green
  intensity scaled to Phred score (faint = low, bright = high). **Hover any
  quality character** to see Q value, error probability, and accuracy.
- **`<color>…</color>` override.** Force coloring of short or ambiguous
  fragments by wrapping them in tags. The tags themselves render muted grey.

## Palettes

| Alphabet | Colors |
| --- | --- |
| **Nucleotide** | A green · C blue · G amber · T/U red · IUPAC ambig grey |
| **Amino acid** (Clustal-by-class) | hydrophobic `AVLIMFW` blue · `KR` red · `DE` purple · polar `NQST` green · `C` pink · `G` orange · `P` olive · aromatic `HY` teal |
| **FASTQ quality** | green at Phred-score-scaled intensity (Q8…Q40 mapped to faint…solid) |
| **Gaps / tags** | muted grey |

## Settings

| Setting | Default | Purpose |
| --- | --- | --- |
| `biocolor.enabled` | `true` | master switch |
| `biocolor.autoDetect` | `true` | detect sequences outside `<color>` blocks |
| `biocolor.conservation` | `true` | shade alignment columns by conservation |
| `biocolor.colorTags` | `true` | dim literal `<color>` tags |

Command: **Biocolor: Toggle Coloring** (Ctrl/Cmd+Shift+P → Biocolor).

## Quick try

Open `showcase.txt` in this repo. Every feature is demonstrated in a single
plain-text file — sections for NT auto-detect, IUPAC grey, AA auto-detect,
`<color>` overrides, MSA conservation, telotron-style locus blocks (with gaps),
and FASTQ blocks with hoverable Phred quality.

## Install

```bash
code --install-extension biocolor-0.3.0.vsix
```

Or search **Biocolor** in the VS Code Extensions view (Ctrl/Cmd+Shift+X).

## License

MIT.
