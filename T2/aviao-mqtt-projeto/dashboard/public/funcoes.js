// Toda a logica de UI fica aqui, exposta como funcoes globais (sem module.exports,
// isso roda direto no navegador via <script src="funcoes.js">, igual ao padrao
// que vinha no material da disciplina).

const MAX_PONTOS = 30; // mantem so os ultimos N pontos no grafico, senao cresce pra sempre
const MAX_PONTOS_ROTA = 120; // cobre toda a aproximacao de 6 km a velocidade nominal

// Um "estado" por grupo (aviao real G1, simulado G2), cada um com seu proprio
// contador de pontos — nao dependem de estarem sincronizados no tempo.
const estado = {
  G1: { contador: 0, pitch: [], altitude: [], velocidade: [], rota: [], distancia: 0, finalizado: false },
  G2: { contador: 0, pitch: [], altitude: [], velocidade: [], rota: [], distancia: 0, finalizado: false }
};

// Separacao inicial entre os dois avioes. A rota do memorial tem 6 km entre
// as pontas: cada aviao percorre 6 km ate a posicao inicial do outro.
const ROTA_KM = 6;
const ROTA_METADE_KM = ROTA_KM / 2;

const cores = {
  G1: 'rgba(15, 51, 118, 1)',   // azul (aviao real)
  G2: 'rgba(244, 67, 54, 1)'    // vermelho (aviao simulado)
};

let charts = {}; // { altitude: Chart, velocidade: Chart, pitch: Chart }
let colisaoDetectada = false;

function atualiza_hora() {
  const el = document.getElementById('dia_hora');
  if (el) el.textContent = new Date().toLocaleTimeString('pt-BR');
}

function atualizaCard(grupo, valores) {
  const statusEl = document.getElementById(`status-${grupo}`);
  if (statusEl) {
    statusEl.textContent = 'conectado';
    statusEl.className = 'status conectado';
  }
  const setar = (campo, valor) => {
    const el = document.getElementById(`${campo}-${grupo}`);
    if (el) el.textContent = valor;
  };
  setar('pitch', valores.pitch);
  setar('altitude', valores.altitude);
  setar('velocidade', valores.velocidade);
  setar('distancia', valores.distanciaPercorrida);
}

function criaOuAtualizaGrafico(chaveGrafico, canvasId, campo, titulo) {
  const datasets = ['G1', 'G2'].map((grupo) => ({
    label: grupo === 'G1' ? 'Aviao Real (G1)' : 'Aviao Simulado (G2)',
    borderColor: cores[grupo],
    backgroundColor: cores[grupo],
    data: estado[grupo][campo].slice(),
    fill: false,
    tension: 0.2,
    pointRadius: 2
  }));

  if (charts[chaveGrafico]) {
    charts[chaveGrafico].data.datasets = datasets;
    charts[chaveGrafico].update('none');
    return;
  }

  charts[chaveGrafico] = new Chart(document.getElementById(canvasId), {
    type: 'line',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false, // sem isso, o canvas cresce sem limite dentro de um container sem altura fixa
      parsing: false, // os dados ja vem como {x, y}
      scales: {
        x: { type: 'linear', title: { display: true, text: 'amostra' } },
        y: { title: { display: true, text: titulo } }
      },
      plugins: { title: { display: true, text: titulo } }
    }
  });
}

function verificaSeparacao() {
  const banner = document.getElementById('separacao');
  const texto = document.getElementById('separacao-texto');
  if (!banner || !texto) return;

  const altG1 = estado.G1.altitude.length ? estado.G1.altitude[estado.G1.altitude.length - 1].y : null;
  const altG2 = estado.G2.altitude.length ? estado.G2.altitude[estado.G2.altitude.length - 1].y : null;

  if (altG1 === null || altG2 === null) {
    banner.className = 'separation-banner aguardando';
    texto.textContent = 'Aguardando dados dos dois avioes...';
    return;
  }

  const posG1 = calculaPosicao('G1');
  const posG2 = calculaPosicao('G2');
  if (posG1 === posG2 && altG1 === altG2) {
    colisaoDetectada = true;
  }

  if (colisaoDetectada) {
    banner.className = 'separation-banner colisao';
    texto.textContent = `COLISAO — os avioes ocupam a mesma posicao (${posG1.toFixed(2)} km / ${altG1.toFixed(0)} m)`;
    return;
  }

  const separacao = Math.abs(altG1 - altG2);

  // Limiares do memorial descritivo: >=200m seguro, <=100m risco de colisao,
  // entre os dois e uma zona de atencao (nao especificada, mas util no dashboard).
  if (separacao <= 100) {
    banner.className = 'separation-banner risco';
    texto.textContent = `RISCO DE COLISAO — separacao vertical de ${separacao.toFixed(0)}m`;
  } else if (separacao < 200) {
    banner.className = 'separation-banner atencao';
    texto.textContent = `Atencao — separacao vertical de ${separacao.toFixed(0)}m`;
  } else {
    banner.className = 'separation-banner seguro';
    texto.textContent = `Separacao segura — ${separacao.toFixed(0)}m entre os avioes`;
  }
}

function calculaPosicao(grupo) {
  const d = Math.min(estado[grupo].distancia / 1000, ROTA_KM); // metros -> km
  // G1 comeca na ponta esquerda (-metade) andando pra direita (+d)
  // G2 comeca na ponta direita (+metade) andando pra esquerda (-d)
  return grupo === 'G1' ? -ROTA_METADE_KM + d : ROTA_METADE_KM - d;
}

function registraPosicaoNaRota(grupo) {
  if (estado[grupo].finalizado) return;
  estado[grupo].rota.push({
    x: calculaPosicao(grupo),
    y: estado[grupo].altitude[estado[grupo].altitude.length - 1].y
  });
  if (estado[grupo].rota.length > MAX_PONTOS_ROTA) estado[grupo].rota.shift();
}

function criaOuAtualizaMapa() {
  const canvasId = 'chart-mapa';
  let posG1 = calculaPosicao('G1');
  let posG2 = calculaPosicao('G2');

  const datasets = [
    {
      label: 'Aviao Real (G1)',
      borderColor: cores.G1,
      backgroundColor: cores.G1,
      data: estado.G1.rota.slice(),
      showLine: true,
      tension: 0.2,
      pointRadius: (context) => context.dataIndex === context.dataset.data.length - 1 ? 10 : 2,
      pointStyle: 'triangle',
      rotation: 90 // aponta pra direita, sentido do voo do G1
    },
    {
      label: 'Aviao Simulado (G2)',
      borderColor: cores.G2,
      backgroundColor: cores.G2,
      data: estado.G2.rota.slice(),
      showLine: true,
      tension: 0.2,
      pointRadius: (context) => context.dataIndex === context.dataset.data.length - 1 ? 10 : 2,
      pointStyle: 'triangle',
      rotation: 270 // aponta pra esquerda, sentido do voo do G2
    }
  ];

  if (charts.mapa) {
    charts.mapa.data.datasets = datasets;
    charts.mapa.update('none');
    return;
  }

  charts.mapa = new Chart(document.getElementById(canvasId), {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          min: -ROTA_METADE_KM,
          max: ROTA_METADE_KM,
          title: { display: true, text: 'posicao na rota (km)' }
        },
        y: {
          title: { display: true, text: 'altitude (m)' }
        }
      },
      plugins: {
        title: {
          display: true,
          text: 'Posicao na Rota — altitude durante o cruzamento'
        },
        legend: { position: 'bottom' }
      }
    }
  });
}

function registraDado(grupo, valores) {
  const s = estado[grupo];
  const distancia = Number(valores.distanciaPercorrida);
  if (!Number.isFinite(distancia) || distancia < s.distancia) return;
  const x = s.contador++;

  s.pitch.push({ x, y: valores.pitch });
  s.altitude.push({ x, y: valores.altitude });
  s.velocidade.push({ x, y: valores.velocidade });
  s.distancia = Math.min(distancia, ROTA_KM * 1000);

  if (s.pitch.length > MAX_PONTOS) s.pitch.shift();
  if (s.altitude.length > MAX_PONTOS) s.altitude.shift();
  if (s.velocidade.length > MAX_PONTOS) s.velocidade.shift();

  atualizaCard(grupo, valores);
  registraPosicaoNaRota(grupo);
  s.finalizado = s.distancia >= ROTA_KM * 1000;

  criaOuAtualizaGrafico('altitude', 'chart-altitude', 'altitude', 'Altitude (m)');
  criaOuAtualizaGrafico('velocidade', 'chart-velocidade', 'velocidade', 'Velocidade (km/h)');
  criaOuAtualizaGrafico('pitch', 'chart-pitch', 'pitch', 'Pitch (graus)');
  criaOuAtualizaMapa();

  verificaSeparacao();
}