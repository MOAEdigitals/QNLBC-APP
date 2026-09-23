import test from 'node:test';
import assert from 'node:assert/strict';
import { getPersonColor, COLOR_PALETTE } from '../src/utils/personColors.ts';

test('Leader Color Differentiation: Ronnie and Roger must have different colors', () => {
  const ronnieTitles = ['Ronnie', 'BRO RONNIE', 'Brother Ronnie', 'Bro. Ronnie'];
  const rogerTitles = ['Roger', 'TAY ROGER', 'Tatay Roger', 'Bro Roger', 'Brother Roger'];

  const ronnieColors = ronnieTitles.map((n) => getPersonColor(n));
  const rogerColors = rogerTitles.map((n) => getPersonColor(n));

  // Verify internal consistency for Ronnie
  for (const rc of ronnieColors) {
    assert.strictEqual(rc.key, COLOR_PALETTE.amber.key, 'Ronnie should be mapped to Amber');
  }

  // Verify internal consistency for Roger
  for (const rc of rogerColors) {
    assert.strictEqual(rc.key, COLOR_PALETTE.indigo.key, 'Roger should be mapped to Indigo');
  }

  // Verify Ronnie and Roger colors are different
  assert.notStrictEqual(
    COLOR_PALETTE.amber.key,
    COLOR_PALETTE.indigo.key,
    'Ronnie and Roger must have different color keys'
  );

  const broRonnie = getPersonColor('BRO RONNIE');
  const tayRoger = getPersonColor('TAY ROGER');
  assert.notStrictEqual(broRonnie.key, tayRoger.key, 'BRO RONNIE and TAY ROGER must not share the same color');
  assert.notStrictEqual(broRonnie.borderStrong, tayRoger.borderStrong);
});
