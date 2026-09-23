/* Testes das funções puras do site (site/puro.js).
   Roda com o runner embutido do Node — mesmo padrão de .claude/hooks:
     node --test site/tests/puro.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';

await import('../puro.js');
const P = globalThis.ENERGY_PURO;

test('puro.js exporta ENERGY_PURO', () => {
  assert.ok(P, 'globalThis.ENERGY_PURO ausente — puro.js não carregou?');
});

/* ── cpfValido ── */
test('cpfValido aceita CPF com dígitos verificadores corretos', () => {
  assert.equal(P.cpfValido('52998224725'), true);
  assert.equal(P.cpfValido('11144477735'), true); // outro CPF válido conhecido
});

test('cpfValido aceita CPF já mascarado', () => {
  assert.equal(P.cpfValido('529.982.247-25'), true);
});

test('cpfValido rejeita dígitos repetidos (caso clássico de bypass)', () => {
  for (const d of ['0', '1', '5', '9']) {
    assert.equal(P.cpfValido(d.repeat(11)), false, `aceitou ${d.repeat(11)}`);
  }
});

test('cpfValido rejeita DV errado e tamanhos inválidos', () => {
  assert.equal(P.cpfValido('52998224724'), false); // último dígito errado
  assert.equal(P.cpfValido('529982247'), false);   // curto
  assert.equal(P.cpfValido('529982247255'), false); // longo
  assert.equal(P.cpfValido(''), false);
  assert.equal(P.cpfValido('abcdefghijk'), false);
});

/* ── mascaraCpf ── */
test('mascaraCpf formata progressivamente 000.000.000-00', () => {
  assert.equal(P.mascaraCpf('52998224725'), '529.982.247-25');
  assert.equal(P.mascaraCpf('529'), '529');
  assert.equal(P.mascaraCpf('5299'), '529.9');
  assert.equal(P.mascaraCpf('529982247'), '529.982.247'); // sem hífen antes do 10º dígito
  assert.equal(P.mascaraCpf('5299822472'), '529.982.247-2');
});

test('mascaraCpf ignora lixo e limita a 11 dígitos', () => {
  assert.equal(P.mascaraCpf('abc529.982.247-25xyz'), '529.982.247-25');
  assert.equal(P.mascaraCpf('52998224725999'), '529.982.247-25'); // corta excedente
  assert.equal(P.mascaraCpf(''), '');
});

/* ── classeImc (limites exatos das faixas OMS) ── */
test('classeImc respeita os limites exatos das faixas', () => {
  assert.equal(P.classeImc(18.4), 'Abaixo do peso');
  assert.equal(P.classeImc(18.5), 'Peso normal');
  assert.equal(P.classeImc(24.9), 'Peso normal');
  assert.equal(P.classeImc(25), 'Sobrepeso');
  assert.equal(P.classeImc(29.9), 'Sobrepeso');
  assert.equal(P.classeImc(30), 'Obesidade grau I');
  assert.equal(P.classeImc(34.9), 'Obesidade grau I');
  assert.equal(P.classeImc(35), 'Obesidade grau II');
  assert.equal(P.classeImc(39.9), 'Obesidade grau II');
  assert.equal(P.classeImc(40), 'Obesidade grau III');
});

/* ── diaInicialGrade ── */
test('diaInicialGrade: domingo cai na segunda (academia sem grade no dom)', () => {
  assert.equal(P.diaInicialGrade(0), 1);
  assert.equal(P.diaInicialGrade(1), 1);
  assert.equal(P.diaInicialGrade(3), 3);
  assert.equal(P.diaInicialGrade(6), 6);
  assert.equal(P.diaInicialGrade(7), 1); // fora de faixa → fallback seguro
});

/* ── duplicacoesTicker ── */
test('duplicacoesTicker: zero quando a metade já cobre a faixa', () => {
  assert.equal(P.duplicacoesTicker(4000, 1500), 0); // metade 2000 ≥ 1500
  assert.equal(P.duplicacoesTicker(3136, 1568), 0); // metade exata = faixa
});

test('duplicacoesTicker: duplica até a metade cobrir a faixa', () => {
  assert.equal(P.duplicacoesTicker(2800, 1568), 1); // metade 1400 < 1568 → 5600
  assert.equal(P.duplicacoesTicker(2800, 3000), 2); // 1400→2800 <3000 → 11200/2=5600
  assert.equal(P.duplicacoesTicker(2800, 25000), 4); // estoura a guarda
});
