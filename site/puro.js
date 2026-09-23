/* Funções puras do site — sem DOM, sem estado. Carregada antes de app.js
   (script clássico: funciona em file:// e dentro da CSP 'self').
   Testável em Node: importar este arquivo e ler globalThis.ENERGY_PURO. */
(function (g) {
  'use strict';

  /* 000.000.000-00 progressivo; ignora não-dígitos, limita a 11. */
  const mascaraCpf = (valor) =>
    valor
      .replace(/\D/g, '')
      .slice(0, 11)
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');

  /* Aceita com ou sem máscara; confere os dois dígitos verificadores. */
  const cpfValido = (valor) => {
    const v = String(valor).replace(/\D/g, '');
    if (!/^\d{11}$/.test(v) || /^(\d)\1{10}$/.test(v)) return false;
    const dv = (n) => {
      let s = 0;
      for (let i = 0; i < n; i += 1) s += Number(v[i]) * (n + 1 - i);
      const r = (s * 10) % 11;
      return r === 10 ? 0 : r;
    };
    return dv(9) === Number(v[9]) && dv(10) === Number(v[10]);
  };

  /* Faixas OMS — limites exatos importam (18.5/25/30/35/40). */
  const classeImc = (v) =>
    v < 18.5 ? 'Abaixo do peso'
    : v < 25 ? 'Peso normal'
    : v < 30 ? 'Sobrepeso'
    : v < 35 ? 'Obesidade grau I'
    : v < 40 ? 'Obesidade grau II'
    : 'Obesidade grau III';

  /* Domingo (0) não tem grade: a aba inicial cai na segunda (1). */
  const diaInicialGrade = (hoje) => (hoje >= 1 && hoje <= 6 ? hoje : 1);

  /* Quantas duplicações do trilho até cada metade cobrir a faixa
     (o loop anima -50%; metade < faixa deixa buraco na direita). */
  const duplicacoesTicker = (larguraTrilha, larguraFaixa, max = 4) => {
    let n = 0;
    let w = larguraTrilha;
    while (w / 2 < larguraFaixa && n < max) {
      w *= 2;
      n += 1;
    }
    return n;
  };

  g.ENERGY_PURO = { mascaraCpf, cpfValido, classeImc, diaInicialGrade, duplicacoesTicker };
})(typeof window !== 'undefined' ? window : globalThis);
