const MAX_PONTOS = 30; // mantem so os ultimos N pontos no grafico, senao cresce pra sempre

const estado = {
  G7: { contador: 0, pitch: [], altitude: [], velocidade: [], distancia: 0 },
  G8: { contador: 0, pitch: [], altitude: [], velocidade: [], distancia: 0 }
};

const ROTA_KM = 60;
const ROTA_METADE_KM = ROTA_KM / 2;

const AVIAO_TAMANHO_M = 50;

const PROXIMIDADE_HORIZONTAL_M = 500;

const cores = {
  G7: 'rgba(15, 51, 118, 1)',   
  G8: 'rgba(244, 67, 54, 1)'    
};

let charts = {}; // { altitude: Chart, velocidade: Chart, pitch: Chart }

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
  const datasets = ['G7', 'G8'].map((grupo) => ({
    label: grupo === 'G7' ? 'Aviao Real (G7)' : 'Aviao Simulado (G8)',
    borderColor: cores[grupo],
    backgroundColor: cores[grupo],
    data: estado[grupo][campo].slice(),
    fill: false,
    tension: 0.2,
    pointRadius: 2
  }));

  if (charts[chaveGrafico]) {
    charts[chaveGrafico].data.datasets = datasets;
    charts[chaveGrafico].update();
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

  const altG7 = estado.G7.altitude.length ? estado.G7.altitude[estado.G7.altitude.length - 1].y : null;
  const altG8 = estado.G8.altitude.length ? estado.G8.altitude[estado.G8.altitude.length - 1].y : null;

  if (altG7 === null || altG8 === null) {
    banner.className = 'separation-banner aguardando';
    texto.textContent = 'Aguardando dados dos dois avioes...';
    return;
  }

  const vertM = Math.abs(altG7 - altG8);
  const horizM = Math.abs(calculaPosicao('G7') - calculaPosicao('G8')) * 1000; // km -> m

  // So verifica altitude quando tem proximidade minima
  if (horizM > PROXIMIDADE_HORIZONTAL_M) {
    banner.className = 'separation-banner seguro';
    texto.textContent = `Avioes distantes — ${(horizM / 1000).toFixed(1)}km de separacao horizontal`;
    return;
  }

  // verifica colisao considerando tamanho do aviao
  if (horizM <= AVIAO_TAMANHO_M && vertM <= 100) {
    banner.className = 'separation-banner risco';
    texto.textContent = `RISCO DE COLISAO: ${horizM.toFixed(0)}m horizontal, ${vertM.toFixed(0)}m vertical`;
  } else if (vertM < 200) {
    banner.className = 'separation-banner atencao';
    texto.textContent = `Atencao: avioes proximos (${horizM.toFixed(0)}m horizontal, ${vertM.toFixed(0)}m vertical)`;
  } else {
    banner.className = 'separation-banner seguro';
    texto.textContent = `Proximos na rota mas separacao vertical segura: ${vertM.toFixed(0)}m`;
  }
}

function calculaPosicao(grupo) {
  const d = estado[grupo].distancia / 1000; // metros -> km
  // G7 comeca na ponta esquerda (-metade) andando pra direita (+d)
  // G8 comeca na ponta direita (+metade) andando pra esquerda (-d)
  return grupo === 'G7' ? -ROTA_METADE_KM + d : ROTA_METADE_KM - d;
}

function criaOuAtualizaMapa() {
  const canvasId = 'chart-mapa';
  const posG7 = calculaPosicao('G7');
  const posG8 = calculaPosicao('G8');

  const datasets = [
    {
      label: 'Aviao Real (G7)',
      borderColor: cores.G7,
      backgroundColor: cores.G7,
      data: [{ x: posG7, y: 1 }],
      pointRadius: 10,
      pointStyle: 'triangle',
      rotation: 90 // aponta pra direita, sentido do voo do G7
    },
    {
      label: 'Aviao Simulado (G8)',
      borderColor: cores.G8,
      backgroundColor: cores.G8,
      data: [{ x: posG8, y: -1 }],
      pointRadius: 10,
      pointStyle: 'triangle',
      rotation: 270 // aponta pra esquerda, sentido do voo do G8
    }
  ];

  if (charts.mapa) {
    charts.mapa.data.datasets = datasets;
    charts.mapa.update();
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
          min: -3, max: 3,
          ticks: { display: false },
          title: { display: true, text: '' }
        }
      },
      plugins: { title: { display: true, text: 'Posicao na Rota' } }
    }
  });
}

function registraDado(grupo, valores) {
  const s = estado[grupo];
  const x = s.contador++;

  s.pitch.push({ x, y: valores.pitch });
  s.altitude.push({ x, y: valores.altitude });
  s.velocidade.push({ x, y: valores.velocidade });
  s.distancia = valores.distanciaPercorrida;

  if (s.pitch.length > MAX_PONTOS) s.pitch.shift();
  if (s.altitude.length > MAX_PONTOS) s.altitude.shift();
  if (s.velocidade.length > MAX_PONTOS) s.velocidade.shift();

  atualizaCard(grupo, valores);

  criaOuAtualizaGrafico('altitude', 'chart-altitude', 'altitude', 'Altitude (m)');
  criaOuAtualizaGrafico('velocidade', 'chart-velocidade', 'velocidade', 'Velocidade (km/h)');
  criaOuAtualizaGrafico('pitch', 'chart-pitch', 'pitch', 'Pitch (graus)');
  criaOuAtualizaMapa();

  verificaSeparacao();
}
