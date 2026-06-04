# Biocolor

Inline coloring for biological sequences. VS Code Extension.

- **Auto-detect.** Runs of nucleotide (≥12 nt, ≥90% NT alphabet) or amino-acid
  (≥12 aa, ≥90% AA alphabet, ≥8 distinct letters) get colored automatically.
- **MSA conservation shading.** Stacked rows are treated as an alignment; ≥3 rows trigger shading.
- **FASTQ data.** Four-line records are
  detected and colored. Quality line color gradient of Phred score. Hover on a
  quality character to see decoded value.
- **`<color>…</color>` override.** Force coloring of short or ambiguous
  fragments by wrapping them in tags. 

