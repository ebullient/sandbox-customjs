# TierPrefilter Test

Simple manual testing script for the TierPrefilter functionality.

## Usage

```bash
# First, ensure the project is built
npm run build

# Run the test script with a markdown file
node test/testPrefilter.mjs <path-to-markdown-file>

# Or use the executable directly
./test/testPrefilter.mjs <path-to-markdown-file>
```

## Test Fixtures

Sample test files are provided in `test/fixtures/`:

- `test1-tier1.md` - Clear Tier 1 (minimal activity)
- `test2-tier4.md` - Clear Tier 4 (elevated)
- `test3-mixed.md` - Mixed signals
- `test4-iteration2.md` - Second iteration with previous assessment
- `test5-complete-example.md` - Complete example from spec

## Examples

```bash
# Test Tier 1 scenario
node test/testPrefilter.mjs test/fixtures/test1-tier1.md

# Test Tier 4 scenario
node test/testPrefilter.mjs test/fixtures/test2-tier4.md

# Test with your own journal file
node test/testPrefilter.mjs path/to/your/journal.md
```

## Output

The script will output the transformed content with structured metrics prepended to the original journal text.
