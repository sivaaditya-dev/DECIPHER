# `samples.js` — Sample Texts Library

**File:** `modules/samples.js`

Contains a curated library of 20+ sample passages from different academic and professional domains, each pre-selected to contain rich, challenging vocabulary that showcases Decipher's analysis capabilities.

---

## Domains Included

| Category | Examples |
|----------|---------|
| Science & Technology | Quantum computing, biotechnology, neuroscience |
| Literature & Arts | Shakespeare excerpt, modernist poetry criticism |
| Law & Politics | Constitutional clauses, international relations |
| Economics | Macroeconomics, market theory |
| Medicine | Pharmacology, surgical descriptions |
| Philosophy | Existentialism, epistemology |
| History | World War II, ancient civilizations |
| Environment | Climate science, ecology |

---

## Public API

### `getSampleText(domain?)`
Returns a sample text string.

| Param | Type | Description |
|-------|------|-------------|
| `domain` | string | Optional domain name. If omitted, a random sample is returned. |

### `getAllDomains()`
Returns an array of all available domain names.

### `getRandomSample()`
Returns a randomly selected sample passage.
