const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSubtitleRows, dedupeSubtitles } = require('../src/feliratokClient');

const fixture = `
<table>
<tr id="vilagit" style="background-color: #fff;">
  <td></td>
  <td class="lang" onclick="adatlapnyitas('a_12345')"><small>Magyar</small></td>
  <td onclick="adatlapnyitas('a_12345')">
    <div class="magyar">Teszt Cím</div>
    <div class="eredeti">Test Title (2024)</div>
  </td>
  <td>Uploader</td>
  <td>2026-01-01</td>
  <td><a href="/index.php?action=letolt&fnev=test.hun.srt&felirat=12345">dl</a></td>
</tr>
<tr id="vilagit" style="background-color: #fff;">
  <td></td>
  <td class="lang" onclick="adatlapnyitas('a_12346')"><small>Angol</small></td>
  <td onclick="adatlapnyitas('a_12346')">
    <div class="magyar">Teszt Cím</div>
    <div class="eredeti">Test Title S01 Pack</div>
  </td>
  <td>Uploader2</td>
  <td>2026-01-02</td>
  <td><a href="/index.php?action=letolt&fnev=test.s01.zip&felirat=12346">dl</a></td>
</tr>
</table>
`;

test('parseSubtitleRows extracts subtitles and season packs', () => {
  const rows = parseSubtitleRows(fixture);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].lang, 'hun');
  assert.equal(rows[1].lang, 'eng');
  assert.match(rows[1].releaseInfo, /Season pack/);
});

test('dedupeSubtitles removes duplicate url+lang items', () => {
  const rows = parseSubtitleRows(fixture);
  const deduped = dedupeSubtitles([rows[0], rows[0], rows[1]]);
  assert.equal(deduped.length, 2);
});
