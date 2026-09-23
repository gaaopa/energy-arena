/* Energy Arena Riachuelo — site institucional (vanilla, sem dependências).
   Tudo que é dado de negócio editável vive em DADOS.
   Origem dos dados reais: api/prisma/seed.ts (unidades, planos) e
   api/prisma/schema.prisma (métodos de check-in e pagamento). */
(() => {
  'use strict';

  const DADOS = {
    // Link do portal de gestão (app web/). Se o site for servido no mesmo
    // domínio do app, '/login' resolve; em host separado, troque pela URL
    // completa (ex.: 'https://app.energyarena.com.br/login').
    portalUrl: '/login',

    contato: {
      // Número real, do site oficial academiaenergyarena.com: (21) 97564-4343.
      whatsapp: '5521975644343',
      telefoneExibicao: '(21) 3333-1000',
      mensagem:
        'Olá, vim pelo site da ENERGY ARENA e gostaria de saber quais os planos e beneficios!',
    },

    // Grade real do Centro de Lutas — transcrita do quadro de horários
    // oficial (CT VP Fight RJ). Seg–Sex; sábado e domingo sem aula coletiva.
    // dia: 0=dom … 6=sáb (mesma convenção de Date.getDay()).
    grade: [
      { dia: 1, hora: '07:00', nome: 'Jiu-Jitsu', meta: 'Centro de Lutas' },
      { dia: 1, hora: '08:00', nome: 'Boxe', meta: 'Centro de Lutas' },
      { dia: 1, hora: '17:00', nome: 'Capoeira Kids', meta: 'Centro de Lutas' },
      { dia: 1, hora: '18:00', nome: 'Capoeira Adulto', meta: 'Centro de Lutas' },
      { dia: 1, hora: '19:00', nome: 'Muay Thai', meta: 'Centro de Lutas' },
      { dia: 1, hora: '20:00', nome: 'Luta Livre', meta: 'Centro de Lutas' },
      { dia: 2, hora: '07:00', nome: 'Muay Thai', meta: 'Centro de Lutas' },
      { dia: 2, hora: '18:00', nome: 'Jiu-Jitsu Kids', meta: 'Centro de Lutas' },
      { dia: 2, hora: '19:00', nome: 'Jiu-Jitsu', meta: 'Centro de Lutas' },
      { dia: 2, hora: '20:00', nome: 'Boxe', meta: 'Centro de Lutas' },
      { dia: 3, hora: '07:00', nome: 'Jiu-Jitsu', meta: 'Centro de Lutas' },
      { dia: 3, hora: '08:00', nome: 'Boxe', meta: 'Centro de Lutas' },
      { dia: 3, hora: '17:00', nome: 'Capoeira Kids', meta: 'Centro de Lutas' },
      { dia: 3, hora: '18:00', nome: 'Capoeira Adulto', meta: 'Centro de Lutas' },
      { dia: 3, hora: '19:00', nome: 'Muay Thai', meta: 'Centro de Lutas' },
      { dia: 3, hora: '20:00', nome: 'Luta Livre', meta: 'Centro de Lutas' },
      { dia: 4, hora: '07:00', nome: 'Muay Thai', meta: 'Centro de Lutas' },
      { dia: 4, hora: '18:00', nome: 'Jiu-Jitsu Kids', meta: 'Centro de Lutas' },
      { dia: 4, hora: '19:00', nome: 'Jiu-Jitsu', meta: 'Centro de Lutas' },
      { dia: 4, hora: '20:00', nome: 'Boxe', meta: 'Centro de Lutas' },
      { dia: 5, hora: '07:00', nome: 'Muay Thai', meta: 'Centro de Lutas' },
      { dia: 5, hora: '08:00', nome: 'Boxe', meta: 'Centro de Lutas' },
      { dia: 5, hora: '18:00', nome: 'Muay Thai Feminino', meta: 'Centro de Lutas' },
      { dia: 5, hora: '19:00', nome: 'Muay Thai', meta: 'Centro de Lutas' },
    ],
    diasRotulo: ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'],
  };

  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
  const PURO = globalThis.ENERGY_PURO; // site/puro.js (defer preserva a ordem)

  /* ── Header: estado rolado + menu mobile ─────────────────── */
  const topo = $('#topo');
  const nav = $('#nav');
  const navToggle = $('#navToggle');

  const atualizaTopo = () => {
    if (topo) topo.classList.toggle('topo--rolado', window.scrollY > 8);
    const vt = $('#voltarTopo');
    if (vt) vt.hidden = window.scrollY < 600;
  };
  window.addEventListener('scroll', atualizaTopo, { passive: true });
  atualizaTopo();

  if (navToggle && nav) {
    navToggle.addEventListener('click', () => {
      const aberta = nav.classList.toggle('nav--aberta');
      navToggle.setAttribute('aria-expanded', String(aberta));
      navToggle.setAttribute('aria-label', aberta ? 'Fechar menu' : 'Abrir menu');
    });
    nav.addEventListener('click', (e) => {
      if (e.target instanceof HTMLAnchorElement) {
        nav.classList.remove('nav--aberta');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'Abrir menu');
      }
    });
    /* Toque fora do painel fecha o menu (mobile). */
    document.addEventListener('click', (e) => {
      if (
        nav.classList.contains('nav--aberta') &&
        e.target instanceof Node &&
        !nav.contains(e.target) &&
        !navToggle.contains(e.target)
      ) {
        nav.classList.remove('nav--aberta');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'Abrir menu');
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && nav.classList.contains('nav--aberta')) {
        nav.classList.remove('nav--aberta');
        navToggle.setAttribute('aria-expanded', 'false');
        navToggle.setAttribute('aria-label', 'Abrir menu');
        navToggle.focus();
      }
    });
  }

  /* ── Portal do aluno ─────────────────────────────────────── */
  $$('a[href="/login"]').forEach((a) => a.setAttribute('href', DADOS.portalUrl));

  /* ── Ticker: o loop anima -50%, então cada metade do trilho
     precisa ser >= a largura da faixa; se for menor, sobra espaço
     vazio à direita no meio da animação. Duplicamos o conteúdo
     inteiro (metades continuam idênticas) até cobrir. */
  const tickerFaixa = $('.ticker');
  const tickerTrack = $('.ticker__track');
  if (tickerFaixa && tickerTrack) {
    const preencherTicker = () => {
      const n = PURO.duplicacoesTicker(tickerTrack.scrollWidth, tickerFaixa.clientWidth);
      for (let i = 0; i < n; i += 1) {
        for (const item of Array.from(tickerTrack.children)) {
          tickerTrack.appendChild(item.cloneNode(true));
        }
      }
    };
    preencherTicker();
    window.addEventListener('resize', preencherTicker);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(preencherTicker).catch(() => {});
    }
  }

  /* ── IntersectionObserver é opcional: sem ele, nada quebra ── */
  const temIO = 'IntersectionObserver' in window;
  const reduzMov =
    'matchMedia' in window &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Scrollspy: marca link da seção visível ──────────────── */
  const linksNav = $$('.nav a[href^="#"]');
  if (temIO) {
    const secoes = linksNav
      .map((a) => $(a.getAttribute('href')))
      .filter(Boolean);
    const spy = new IntersectionObserver(
      (entradas) => {
        for (const en of entradas) {
          if (!en.isIntersecting) continue;
          linksNav.forEach((a) =>
            a.classList.toggle('nav--ativo', a.getAttribute('href') === `#${en.target.id}`),
          );
        }
      },
      { rootMargin: '-40% 0px -55% 0px' },
    );
    secoes.forEach((s) => spy.observe(s));
  }

  /* ── Reveal on scroll (sem IO, os elementos ficam visíveis) ── */
  if (temIO) {
    const alvosRevelar = $$('.card, .plano, .stat');
    alvosRevelar.forEach((el) => el.classList.add('revelar'));
    const revelarObs = new IntersectionObserver(
      (entradas) => {
        for (const en of entradas) {
          if (en.isIntersecting) {
            en.target.classList.add('revelar--visivel');
            revelarObs.unobserve(en.target);
          }
        }
      },
      { threshold: 0.12 },
    );
    alvosRevelar.forEach((el) => revelarObs.observe(el));
  }

  /* ── Contadores do hero ──────────────────────────────────── */
  const animaContador = (el) => {
    const alvo = Number(el.dataset.contador);
    const prefixo = el.dataset.prefixo || '';
    const sufixo = el.dataset.sufixo || '';
    if (!Number.isFinite(alvo)) return;
    if (reduzMov) {
      el.textContent = `${prefixo}${alvo}${sufixo}`;
      return;
    }
    const dur = 1200;
    const t0 = performance.now();
    const passo = (t) => {
      const p = Math.min((t - t0) / dur, 1);
      const v = Math.round(alvo * (1 - (1 - p) ** 3));
      el.textContent = `${prefixo}${v}${sufixo}`;
      if (p < 1) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  };
  if (temIO) {
    const contObs = new IntersectionObserver(
      (entradas) => {
        for (const en of entradas) {
          if (en.isIntersecting) {
            animaContador(en.target);
            contObs.unobserve(en.target);
          }
        }
      },
      { threshold: 0.6 },
    );
    $$('[data-contador]').forEach((el) => contObs.observe(el));
  } else {
    $$('[data-contador]').forEach(animaContador);
  }

  /* ── Grade de aulas: abas por dia ────────────────────────── */
  const abas = $('#abasDias');
  const listaAulas = $('#listaAulas');
  if (abas && listaAulas) {
    const diaInicial = PURO.diaInicialGrade(new Date().getDay());

    const renderDia = (dia) => {
      $$('button', abas).forEach((b) =>
        b.setAttribute('aria-selected', String(Number(b.dataset.dia) === dia)),
      );
      listaAulas.textContent = '';
      const aulas = DADOS.grade
        .filter((a) => a.dia === dia)
        .sort((a, b) => a.hora.localeCompare(b.hora));
      if (!aulas.length) {
        const li = document.createElement('li');
        li.className = 'aulas__vazio';
        li.textContent = 'Sem aula coletiva neste dia — musculação liberada.';
        listaAulas.appendChild(li);
        return;
      }
      for (const aula of aulas) {
        const li = document.createElement('li');
        const hora = document.createElement('span');
        const nome = document.createElement('span');
        const meta = document.createElement('span');
        hora.className = 'aula__hora';
        nome.className = 'aula__nome';
        meta.className = 'aula__meta';
        hora.textContent = aula.hora;
        nome.textContent = aula.nome;
        meta.textContent = aula.meta;
        li.appendChild(hora);
        li.appendChild(nome);
        li.appendChild(meta);
        listaAulas.appendChild(li);
      }
    };

    for (let dia = 1; dia <= 6; dia += 1) {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', 'listaAulas');
      b.dataset.dia = String(dia);
      b.textContent = DADOS.diasRotulo[dia];
      b.setAttribute('aria-selected', 'false');
      b.addEventListener('click', () => renderDia(dia));
      abas.appendChild(b);
    }
    renderDia(diaInicial);
  }

  /* ── Calculadora de IMC ──────────────────────────────────── */
  const formImc = $('#formImc');
  const imcOut = $('#imcResultado');

  if (formImc && imcOut) {
    formImc.addEventListener('submit', (e) => {
      e.preventDefault();
      const peso = $('#peso').valueAsNumber;
      const altura = $('#altura').valueAsNumber;
      if (!Number.isFinite(peso) || !Number.isFinite(altura) || peso <= 0 || altura <= 0) {
        imcOut.textContent = 'Preencha peso e altura válidos.';
        return;
      }
      if (peso < 20 || peso > 400 || altura < 1 || altura > 2.5) {
        imcOut.textContent = 'Valores fora da faixa — confira os campos.';
        return;
      }
      const imc = peso / (altura * altura);
      imcOut.textContent = '';
      const strong = document.createElement('strong');
      const classe = document.createElement('span');
      strong.textContent = imc.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
      classe.className = 'imc__classe';
      classe.textContent = PURO.classeImc(imc);
      imcOut.appendChild(strong);
      imcOut.appendChild(document.createTextNode(' '));
      imcOut.appendChild(classe);
    });
  }

  /* ── Contato → WhatsApp (nada sai do navegador) ──────────── */
  const formContato = $('#formContato');
  const btnWhatsapp = $('#btnWhatsapp');
  const avisoWhatsapp = $('#avisoWhatsapp');
  const numeroWa = /^\d{10,15}$/.test(DADOS.contato.whatsapp)
    ? DADOS.contato.whatsapp
    : null;

  if (!numeroWa && btnWhatsapp) {
    btnWhatsapp.disabled = true;
    btnWhatsapp.textContent = 'WhatsApp em breve — ligue ' + DADOS.contato.telefoneExibicao;
    if (avisoWhatsapp) avisoWhatsapp.hidden = false;
  }

  if (formContato) {
    formContato.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!numeroWa) return;
      const erroContato = $('#erroContato');
      const nome = $('#nome').value.trim();
      if (!nome) {
        if (erroContato) {
          erroContato.textContent = 'Informe seu nome para continuarmos.';
          erroContato.hidden = false;
        }
        $('#nome').focus();
        return;
      }
      if (erroContato) erroContato.hidden = true;
      const partes = [
        DADOS.contato.mensagem,
        `Sou ${nome}. Interesse: ${$('#interesse').value} (unidade ${$('#unidade').value}).`,
      ];
      const extra = $('#mensagem').value.trim();
      if (extra) partes.push(extra);
      const url = `https://wa.me/${numeroWa}?text=${encodeURIComponent(partes.join(' '))}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    });
  }

  /* ── Rodapé: ano + voltar ao topo ────────────────────────── */
  const ano = $('#ano');
  if (ano) ano.textContent = String(new Date().getFullYear());
  const voltarTopo = $('#voltarTopo');
  if (voltarTopo) {
    voltarTopo.addEventListener('click', () =>
      window.scrollTo({ top: 0, behavior: reduzMov ? 'auto' : 'smooth' }),
    );
  }
})();
